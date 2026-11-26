(() => {
  const config = window.supabaseConfig || {};
  const recoveryRequested = new URLSearchParams(window.location.search).get("recovery") === "1"
    || new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
  const loginPanel = document.querySelector("#login-panel");
  const adminPanel = document.querySelector("#admin-panel");
  const resetPanel = document.querySelector("#password-reset-panel");
  const loginStatus = document.querySelector("#login-status");
  const formStatus = document.querySelector("#form-status");
  const form = document.querySelector("#property-form");
  const photoInput = document.querySelector("#property-photos");
  const photoPreview = document.querySelector("#photo-preview");
  const loginEmail = document.querySelector("#login-email");
  const loginPassword = document.querySelector("#login-password");
  const bucketName = config.photoBucket || "property-photos";
  const typeNames = { piso: "Piso", casa: "Casa / chalet", atico: "Ático", local: "Local", terreno: "Terreno" };
  const operationNames = { venta: "En venta", alquiler: "En alquiler" };
  let client = null;
  let properties = [];
  let photos = [];
  let newFiles = [];
  let editingId = null;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
  const formatPrice = (price, operation) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Number(price) || 0)} €${operation === "alquiler" ? " / mes" : ""}`;

  function status(node, message, kind = "") {
    node.textContent = message;
    node.className = `${node.id.includes("login") ? "manager-status" : "manager-status form-status"} ${kind ? `status-${kind}` : ""}`;
  }

  function showAdmin(email) {
    loginPanel.hidden = true;
    resetPanel.hidden = true;
    adminPanel.hidden = false;
    document.querySelector(".publish-notice strong").textContent = `Sesión iniciada como ${email}`;
    loadProperties();
  }

  function showLogin() {
    adminPanel.hidden = true;
    resetPanel.hidden = true;
    loginPanel.hidden = false;
  }

  function showRecovery() {
    loginPanel.hidden = true;
    adminPanel.hidden = true;
    resetPanel.hidden = false;
  }

  async function loadProperties() {
    const { data, error } = await client.from("properties").select("*").order("created_at", { ascending: false });
    if (error) {
      status(formStatus, `No se pudieron cargar las fichas: ${error.message}`, "error");
      return;
    }
    properties = data || [];
    renderProperties();
  }

  function renderPhotos() {
    photoPreview.innerHTML = photos.map((photo, index) => `
      <div class="photo-thumb">
        <img src="${escapeHTML(photo.url)}" alt="Foto ${index + 1}" />
        <button type="button" data-remove-photo="${index}" aria-label="Quitar foto ${index + 1}">×</button>
        <span>${photo.path ? "Guardada" : "Foto nueva"}</span>
      </div>`).join("");
    newFiles.forEach((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      const tile = document.createElement("div");
      tile.className = "photo-thumb";
      tile.innerHTML = `<img src="${objectUrl}" alt="Foto nueva" /><button type="button" data-remove-new-photo="${index}" aria-label="Quitar foto">×</button><span>Por subir</span>`;
      photoPreview.appendChild(tile);
    });
  }

  function renderProperties() {
    const query = document.querySelector("#property-search").value.trim().toLocaleLowerCase("es");
    const visible = properties.filter((property) => `${property.title} ${property.location}`.toLocaleLowerCase("es").includes(query));
    document.querySelector("#property-count").textContent = String(properties.length);
    document.querySelector("#empty-list").hidden = visible.length > 0;
    document.querySelector("#managed-list").innerHTML = visible.map((property) => `
      <article class="managed-card">
        ${property.images?.[0]?.url ? `<img src="${escapeHTML(property.images[0].url)}" alt="" />` : "<div class=\"managed-image-empty\"></div>"}
        <div class="managed-card-copy"><strong>${escapeHTML(property.title)}</strong><span>${escapeHTML(property.location)} · ${formatPrice(property.price, property.operation)} · ${property.is_published ? "Publicado" : "Borrador"}</span></div>
        <div class="managed-card-actions"><button type="button" data-edit="${escapeHTML(property.id)}">Editar</button><button type="button" class="delete-button" data-delete="${escapeHTML(property.id)}">Eliminar</button></div>
      </article>`).join("");
  }

  function clearForm() {
    form.reset();
    document.querySelector("#property-id").value = "";
    document.querySelector("#form-heading").textContent = "Añadir propiedad";
    document.querySelector("#save-property").innerHTML = "Guardar propiedad <span>↗</span>";
    document.querySelector("#cancel-edit").hidden = true;
    editingId = null;
    photos = [];
    newFiles = [];
    photoInput.value = "";
    renderPhotos();
    status(formStatus, "");
  }

  function editProperty(property) {
    editingId = property.id;
    document.querySelector("#property-id").value = property.id;
    document.querySelector("#property-title").value = property.title || "";
    document.querySelector("#property-operation").value = property.operation || "venta";
    document.querySelector("#property-type").value = property.type || "casa";
    document.querySelector("#property-price").value = property.price ?? "";
    document.querySelector("#property-badge").value = property.badge || "";
    document.querySelector("#property-location").value = property.location || "";
    document.querySelector("#property-address").value = property.address || "";
    document.querySelector("#property-map").value = property.map_url || "";
    document.querySelector("#property-area").value = property.area || "";
    document.querySelector("#property-bedrooms").value = property.bedrooms || "";
    document.querySelector("#property-bathrooms").value = property.bathrooms || "";
    document.querySelector("#property-parking").value = property.parking || "";
    document.querySelector("#property-description").value = property.description || "";
    document.querySelector("#property-features").value = (property.features || []).join("\n");
    document.querySelector("#property-published").checked = Boolean(property.is_published);
    photos = Array.isArray(property.images) ? property.images : [];
    newFiles = [];
    renderPhotos();
    document.querySelector("#form-heading").textContent = "Editar propiedad";
    document.querySelector("#save-property").innerHTML = "Guardar cambios <span>↗</span>";
    document.querySelector("#cancel-edit").hidden = false;
    status(formStatus, "Editando esta ficha.");
    document.querySelector("#property-title").focus();
    window.scrollTo({ top: document.querySelector(".editor-panel").getBoundingClientRect().top + window.scrollY - 20, behavior: "smooth" });
  }

  async function uploadPhotos() {
    const uploaded = [];
    for (const file of newFiles) {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error } = await client.storage.from(bucketName).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = client.storage.from(bucketName).getPublicUrl(path);
      uploaded.push({ url: data.publicUrl, path });
    }
    return [...photos, ...uploaded];
  }

  async function deleteRemovedPhotos(previous, kept) {
    const keptPaths = new Set(kept.map((photo) => photo.path).filter(Boolean));
    const removedPaths = previous.map((photo) => photo.path).filter((path) => path && !keptPaths.has(path));
    if (removedPaths.length) await client.storage.from(bucketName).remove(removedPaths);
  }

  async function signIn(event) {
    event.preventDefault();
    status(loginStatus, "Comprobando acceso…");
    const email = loginEmail.value.trim().toLowerCase();
    if (email !== String(config.adminEmail || "").toLowerCase()) {
      status(loginStatus, `El usuario autorizado es ${config.adminEmail}.`, "error");
      return;
    }
    const { data, error } = await client.auth.signInWithPassword({ email, password: loginPassword.value });
    if (error) {
      status(loginStatus, "No se pudo iniciar sesión. Revisa el correo y la contraseña.", "error");
      return;
    }
    loginPassword.value = "";
    showAdmin(data.user.email);
  }

  async function saveProperty(event) {
    event.preventDefault();
    const title = document.querySelector("#property-title").value.trim();
    const location = document.querySelector("#property-location").value.trim();
    const price = Number(document.querySelector("#property-price").value);
    if (!title || !location || price <= 0) {
      status(formStatus, "Completa el título, la zona y un precio mayor que cero.", "error");
      return;
    }
    const submit = document.querySelector("#save-property");
    submit.disabled = true;
    status(formStatus, "Guardando la ficha y las fotografías…");
    const previous = properties.find((item) => item.id === editingId);
    try {
      const images = await uploadPhotos();
      if (!images.length) throw new Error("Añade al menos una fotografía.");
      const operation = document.querySelector("#property-operation").value;
      const payload = {
        title,
        type: document.querySelector("#property-type").value,
        operation,
        price,
        location,
        address: document.querySelector("#property-address").value.trim(),
        map_url: document.querySelector("#property-map").value.trim(),
        bedrooms: Number(document.querySelector("#property-bedrooms").value) || 0,
        bathrooms: Number(document.querySelector("#property-bathrooms").value) || 0,
        area: Number(document.querySelector("#property-area").value) || 0,
        parking: Number(document.querySelector("#property-parking").value) || 0,
        badge: document.querySelector("#property-badge").value.trim() || operationNames[operation],
        description: document.querySelector("#property-description").value.trim(),
        features: document.querySelector("#property-features").value.split(/\n|,/).map((item) => item.trim()).filter(Boolean),
        images,
        is_published: document.querySelector("#property-published").checked
      };
      const result = editingId
        ? await client.from("properties").update(payload).eq("id", editingId)
        : await client.from("properties").insert(payload);
      if (result.error) throw result.error;
      if (previous) await deleteRemovedPhotos(previous.images || [], images);
      clearForm();
      await loadProperties();
      status(formStatus, "Propiedad guardada. La web ya tiene los cambios.", "success");
    } catch (error) {
      status(formStatus, `No se pudo guardar: ${error.message || "revisa la conexión e inténtalo de nuevo."}`, "error");
    } finally {
      submit.disabled = false;
    }
  }

  async function deleteProperty(id) {
    const property = properties.find((item) => item.id === id);
    if (!property || !window.confirm(`¿Eliminar “${property.title}”?`)) return;
    const { error } = await client.from("properties").delete().eq("id", id);
    if (error) {
      status(formStatus, `No se pudo eliminar: ${error.message}`, "error");
      return;
    }
    const paths = (property.images || []).map((photo) => photo.path).filter(Boolean);
    if (paths.length) await client.storage.from(bucketName).remove(paths);
    await loadProperties();
    status(formStatus, "Propiedad eliminada.", "success");
  }

  document.querySelector("#login-form").addEventListener("submit", signIn);
  document.querySelector("#request-password-reset").addEventListener("click", async () => {
    const email = loginEmail.value.trim().toLowerCase();
    if (email !== String(config.adminEmail || "").toLowerCase()) {
      status(loginStatus, `Escribe primero el usuario autorizado: ${config.adminEmail}.`, "error");
      return;
    }
    status(loginStatus, "Enviando el enlace de recuperación…");
    const redirectTo = config.redirectUrl || `${window.location.origin}${window.location.pathname}`;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) status(loginStatus, `No se pudo enviar el correo: ${error.message}`, "error");
    else status(loginStatus, "Revisa tu correo y abre el enlace para crear una contraseña nueva.", "success");
  });
  document.querySelector("#password-reset-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#new-password").value;
    const confirmation = document.querySelector("#confirm-password").value;
    const resetStatus = document.querySelector("#password-reset-status");
    if (password.length < 8) return status(resetStatus, "Usa al menos 8 caracteres.", "error");
    if (password !== confirmation) return status(resetStatus, "Las contraseñas no coinciden.", "error");
    const { error } = await client.auth.updateUser({ password });
    if (error) return status(resetStatus, `No se pudo cambiar: ${error.message}`, "error");
    status(resetStatus, "Contraseña actualizada. Ya puedes entrar al panel.", "success");
    loginPassword.value = "";
    window.history.replaceState({}, document.title, window.location.pathname);
    window.setTimeout(() => showAdmin(config.adminEmail), 1000);
  });
  document.querySelector("#logout-button").addEventListener("click", async () => { await client.auth.signOut(); showLogin(); });
  form.addEventListener("submit", saveProperty);
  document.querySelector("#cancel-edit").addEventListener("click", clearForm);
  document.querySelector("#new-property").addEventListener("click", () => { clearForm(); document.querySelector("#property-title").focus(); });
  document.querySelector("#property-search").addEventListener("input", renderProperties);

  photoInput.addEventListener("change", () => {
    const selected = Array.from(photoInput.files || []);
    const invalid = selected.find((file) => file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalid) {
      status(formStatus, "Cada foto debe ser JPG, PNG o WebP y pesar menos de 8 MB.", "error");
      photoInput.value = "";
      return;
    }
    newFiles.push(...selected);
    photoInput.value = "";
    renderPhotos();
  });

  photoPreview.addEventListener("click", (event) => {
    const removeSaved = event.target.closest("[data-remove-photo]");
    const removeNew = event.target.closest("[data-remove-new-photo]");
    if (removeSaved) photos.splice(Number(removeSaved.dataset.removePhoto), 1);
    if (removeNew) newFiles.splice(Number(removeNew.dataset.removeNewPhoto), 1);
    renderPhotos();
  });

  document.querySelector("#managed-list").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    if (edit) {
      const property = properties.find((item) => item.id === edit.dataset.edit);
      if (property) editProperty(property);
    }
    if (remove) deleteProperty(remove.dataset.delete);
  });

  loginEmail.value = config.adminEmail || "";
  if (!config.url || !config.publishableKey || !window.supabase?.createClient) {
    status(loginStatus, "Falta configurar la conexión con Supabase.", "error");
    document.querySelector("#login-form button").disabled = true;
    return;
  }
  client = window.supabase.createClient(config.url, config.publishableKey);
  client.auth.getSession().then(({ data }) => {
    if (data.session?.user?.email?.toLowerCase() === String(config.adminEmail).toLowerCase()) {
      if (recoveryRequested) showRecovery();
      else showAdmin(data.session.user.email);
    }
    else if (data.session) client.auth.signOut();
  });
  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" || (recoveryRequested && session)) showRecovery();
    else if (!session) showLogin();
  });
})();

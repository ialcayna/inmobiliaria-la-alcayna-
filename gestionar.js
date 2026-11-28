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
  const ownerForm = document.querySelector("#owner-form");
  const photoInput = document.querySelector("#property-photos");
  const photoPreview = document.querySelector("#photo-preview");
  const heroPhotoInput = document.querySelector("#hero-photo-input");
  const heroPhotoPreview = document.querySelector("#hero-photo-preview");
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
  let reviews = [];
  let siteContent = {};
  let heroPhotos = [];
  let newHeroFiles = [];
  let customPages = [];
  let editingPageSlug = "";
  let owners = [];
  let editingOwnerId = null;

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
    loadSiteContent();
    loadOwners();
  }

  function showLogin() {
    adminPanel.hidden = true;
    resetPanel.hidden = true;
    loginPanel.hidden = false;
    owners = [];
    clearOwnerForm();
    renderOwners();
  }

  function showRecovery() {
    loginPanel.hidden = true;
    adminPanel.hidden = true;
    resetPanel.hidden = false;
    owners = [];
    clearOwnerForm();
    renderOwners();
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

  function renderReviews() {
    document.querySelector("#review-list").innerHTML = reviews.map((review, index) => `
      <div class="review-row"><div><strong>${escapeHTML(review.name)}</strong><p>${escapeHTML(review.text)}</p></div><button type="button" class="button button-quiet" data-remove-review="${index}">Quitar</button></div>`).join("")
      || '<p class="editor-help">Todavía no hay reseñas. Puedes añadirlas abajo.</p>';
  }

  async function loadSiteContent() {
    const { data, error } = await client.from("site_settings").select("content").eq("id", "main").maybeSingle();
    if (error) {
      status(document.querySelector("#site-content-status"), "Activa la edición de secciones ejecutando la actualización indicada en el archivo de instrucciones.", "error");
      return;
    }
    siteContent = data?.content || {};
    const fields = {
      "about-title": siteContent.aboutTitle || "Una buena mudanza empieza con confianza.",
      "about-text": siteContent.aboutText || "Comprar o vender una casa es una decisión importante. Por eso ponemos a las personas primero, explicamos cada paso y cuidamos los detalles que hacen que todo resulte más fácil.",
      "about-stat": siteContent.aboutStat || "100%",
      "about-stat-label": siteContent.aboutStatLabel || "Atención personal",
      "contact-phone": siteContent.phone || "",
      "contact-whatsapp": siteContent.whatsapp || "",
      "contact-email": siteContent.email || "inmoalcayna@gmail.com",
      "social-facebook": siteContent.socials?.facebook || "",
      "social-instagram": siteContent.socials?.instagram || "",
      "social-tiktok": siteContent.socials?.tiktok || "",
      "social-linkedin": siteContent.socials?.linkedin || ""
    };
    Object.entries(fields).forEach(([id, value]) => { document.getElementById(id).value = value; });
    heroPhotos = Array.isArray(siteContent.heroImages) ? siteContent.heroImages.filter((photo) => photo?.url && photo.type !== "video") : [];
    customPages = Array.isArray(siteContent.pages) ? siteContent.pages.filter((page) => page?.title && page?.slug) : [];
    renderHeroPhotos();
    renderCustomPages();
    reviews = Array.isArray(siteContent.reviews) ? siteContent.reviews : [];
    renderReviews();
  }

  async function saveSiteContent(event) {
    event.preventDefault();
    const button = document.querySelector("#save-site-content");
    button.disabled = true;
    const content = {
      aboutTitle: document.querySelector("#about-title").value.trim(),
      aboutText: document.querySelector("#about-text").value.trim(),
      aboutStat: document.querySelector("#about-stat").value.trim(),
      aboutStatLabel: document.querySelector("#about-stat-label").value.trim(),
      phone: document.querySelector("#contact-phone").value.trim(),
      whatsapp: document.querySelector("#contact-whatsapp").value.trim(),
      email: document.querySelector("#contact-email").value.trim(),
      socials: {
        facebook: document.querySelector("#social-facebook").value.trim(),
        instagram: document.querySelector("#social-instagram").value.trim(),
        tiktok: document.querySelector("#social-tiktok").value.trim(),
        linkedin: document.querySelector("#social-linkedin").value.trim()
      },
      pages: customPages,
      reviews
    };
    try {
      content.heroImages = await uploadHeroPhotos();
      const { error } = await client.from("site_settings").update({ content, updated_at: new Date().toISOString() }).eq("id", "main");
      if (error) throw error;
      await deleteRemovedPhotos(siteContent.heroImages || [], content.heroImages);
      siteContent = content;
      heroPhotos = content.heroImages;
      newHeroFiles = [];
      renderHeroPhotos();
      status(document.querySelector("#site-content-status"), "Cambios guardados. Ya se muestran en la web.", "success");
    } catch (error) {
      status(document.querySelector("#site-content-status"), `No se pudieron guardar los cambios: ${error.message}`, "error");
    } finally { button.disabled = false; }
  }

  function renderPhotos() {
    photoPreview.innerHTML = photos.map((photo, index) => `
      <div class="photo-thumb">
        ${photo.type === "video" ? `<video src="${escapeHTML(photo.url)}" muted playsinline preload="metadata"></video><b class="media-kind">Vídeo</b>` : `<img src="${escapeHTML(photo.url)}" alt="Foto ${index + 1}" />`}
        <button type="button" data-remove-photo="${index}" aria-label="Quitar foto ${index + 1}">×</button>
        <span>${photo.path ? "Guardada" : "Foto nueva"}</span>
      </div>`).join("");
    newFiles.forEach((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      const tile = document.createElement("div");
      tile.className = "photo-thumb";
      const preview = file.type.startsWith("video/")
        ? `<video src="${objectUrl}" muted playsinline preload="metadata"></video><b class="media-kind">Vídeo</b>`
        : `<img src="${objectUrl}" alt="Foto nueva" />`;
      tile.innerHTML = `${preview}<button type="button" data-remove-new-photo="${index}" aria-label="Quitar archivo">×</button><span>Por subir</span>`;
      photoPreview.appendChild(tile);
    });
  }

  function renderHeroPhotos() {
    heroPhotoPreview.replaceChildren();
    heroPhotos.forEach((photo, index) => {
      const tile = document.createElement("div");
      tile.className = "photo-thumb";
      tile.innerHTML = `<img src="${escapeHTML(photo.url)}" alt="Portada ${index + 1}" /><button type="button" data-remove-hero-photo="${index}" aria-label="Quitar portada ${index + 1}">×</button><span>Portada ${index + 1}</span>`;
      heroPhotoPreview.appendChild(tile);
    });
    newHeroFiles.forEach((file, index) => {
      const tile = document.createElement("div");
      tile.className = "photo-thumb";
      const image = document.createElement("img");
      image.src = URL.createObjectURL(file);
      image.alt = "Nueva foto de portada";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.removeNewHeroPhoto = String(index);
      remove.setAttribute("aria-label", "Quitar foto de portada nueva");
      remove.textContent = "×";
      const caption = document.createElement("span");
      caption.textContent = "Por subir";
      tile.append(image, remove, caption);
      heroPhotoPreview.appendChild(tile);
    });
  }

  function pageSlug(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
      .trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function renderCustomPages() {
    const list = document.querySelector("#custom-page-list");
    list.innerHTML = customPages.map((page) => `
      <article class="custom-page-row"><div><strong>${escapeHTML(page.title)}</strong><span>/${escapeHTML(page.slug)}</span></div>
        <div class="custom-page-actions"><button type="button" data-edit-page="${escapeHTML(page.slug)}">Editar</button><button type="button" data-remove-page="${escapeHTML(page.slug)}">Quitar</button></div>
      </article>`).join("") || '<p class="editor-help">Todavía no hay páginas adicionales.</p>';
  }

  function clearCustomPageForm() {
    editingPageSlug = "";
    document.querySelector("#custom-page-title").value = "";
    document.querySelector("#custom-page-slug").value = "";
    document.querySelector("#custom-page-image").value = "";
    document.querySelector("#custom-page-body").value = "";
    document.querySelector("#save-custom-page").textContent = "Añadir página";
    document.querySelector("#cancel-custom-page").hidden = true;
  }

  function uploadHeroPhotos() {
    return (async () => {
      const uploaded = [];
      for (const original of newHeroFiles) {
        const file = await optimizePhoto(original);
        const path = `${crypto.randomUUID()}-${file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-")}`;
        const { error } = await client.storage.from(bucketName).upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data } = client.storage.from(bucketName).getPublicUrl(path);
        uploaded.push({ url: data.publicUrl, path, type: "image" });
      }
      return [...heroPhotos, ...uploaded];
    })();
  }

  function renderProperties() {
    const query = document.querySelector("#property-search").value.trim().toLocaleLowerCase("es");
    const visible = properties.filter((property) => `${property.title} ${property.location}`.toLocaleLowerCase("es").includes(query));
    document.querySelector("#property-count").textContent = String(properties.length);
    document.querySelector("#empty-list").hidden = visible.length > 0;
    document.querySelector("#managed-list").innerHTML = visible.map((property) => `
      <article class="managed-card">
        ${property.images?.[0]?.url ? (property.images[0].type === "video" ? `<video src="${escapeHTML(property.images[0].url)}" muted playsinline preload="metadata"></video>` : `<img src="${escapeHTML(property.images[0].url)}" alt="" />`) : "<div class=\"managed-image-empty\"></div>"}
        <div class="managed-card-copy"><strong>${escapeHTML(property.title)}</strong><span>${escapeHTML(property.location)} · ${formatPrice(property.price, property.operation)} · ${property.is_published ? "Publicado" : "Borrador"}</span></div>
        <div class="managed-card-actions"><button type="button" data-edit="${escapeHTML(property.id)}">Editar</button><button type="button" class="delete-button" data-delete="${escapeHTML(property.id)}">Eliminar</button></div>
      </article>`).join("");
  }

  function renderOwners() {
    if (!ownerForm) return;
    const query = document.querySelector("#owner-search").value.trim().toLocaleLowerCase("es");
    const visible = owners.filter((owner) => `${owner.full_name} ${owner.address}`.toLocaleLowerCase("es").includes(query));
    document.querySelector("#owner-count").textContent = String(owners.length);
    const empty = document.querySelector("#owner-empty");
    empty.hidden = visible.length > 0;
    empty.querySelector("p").textContent = owners.length ? "No hay propietarios que coincidan con la búsqueda." : "No hay propietarios guardados.";
    document.querySelector("#owner-list").innerHTML = visible.map((owner) => {
      const maskedDni = owner.dni ? `••••••${escapeHTML(owner.dni.slice(-3))}` : "No indicado";
      return `<article class="owner-card">
        <div class="owner-card-copy"><strong>${escapeHTML(owner.full_name)}</strong>
          <span>Teléfono: ${escapeHTML(owner.phone || "No indicado")}</span>
          <span>Correo: ${escapeHTML(owner.email || "No indicado")}</span>
          <span>DNI / NIE: ${maskedDni}</span>
          <span>Dirección: ${escapeHTML(owner.address || "No indicada")}</span>
        </div>
        <div class="owner-card-actions"><button type="button" data-edit-owner="${escapeHTML(owner.id)}">Ver / editar</button><button type="button" class="delete-button" data-delete-owner="${escapeHTML(owner.id)}">Eliminar</button></div>
      </article>`;
    }).join("");
  }

  async function loadOwners() {
    const ownersStatus = document.querySelector("#owners-status");
    status(ownersStatus, "Cargando propietarios…");
    const { data, error } = await client.from("owners").select("id,full_name,phone,email,dni,address,created_at,updated_at").order("full_name", { ascending: true });
    if (error) {
      owners = [];
      renderOwners();
      status(ownersStatus, "No se pudo abrir la lista privada. Ejecuta la actualización de base de datos del archivo de instrucciones.", "error");
      return;
    }
    owners = data || [];
    renderOwners();
    status(ownersStatus, `${owners.length} ${owners.length === 1 ? "propietario" : "propietarios"} en la lista privada.`);
  }

  function clearOwnerForm() {
    if (!ownerForm) return;
    ownerForm.reset();
    document.querySelector("#owner-id").value = "";
    document.querySelector("#save-owner").textContent = "Guardar propietario";
    document.querySelector("#cancel-owner-edit").hidden = true;
    editingOwnerId = null;
  }

  function editOwner(owner) {
    editingOwnerId = owner.id;
    document.querySelector("#owner-id").value = owner.id;
    document.querySelector("#owner-name").value = owner.full_name || "";
    document.querySelector("#owner-phone").value = owner.phone || "";
    document.querySelector("#owner-email").value = owner.email || "";
    document.querySelector("#owner-dni").value = owner.dni || "";
    document.querySelector("#owner-address").value = owner.address || "";
    document.querySelector("#save-owner").textContent = "Guardar cambios";
    document.querySelector("#cancel-owner-edit").hidden = false;
    status(document.querySelector("#owners-status"), "Editando un registro privado.");
    document.querySelector("#owner-name").focus();
  }

  async function saveOwner(event) {
    event.preventDefault();
    const submit = document.querySelector("#save-owner");
    const ownersStatus = document.querySelector("#owners-status");
    const payload = {
      full_name: document.querySelector("#owner-name").value.trim(),
      phone: document.querySelector("#owner-phone").value.trim(),
      email: document.querySelector("#owner-email").value.trim(),
      dni: document.querySelector("#owner-dni").value.trim(),
      address: document.querySelector("#owner-address").value.trim(),
      updated_at: new Date().toISOString()
    };
    if (!payload.full_name) return status(ownersStatus, "Escribe el nombre del propietario.", "error");
    submit.disabled = true;
    status(ownersStatus, "Guardando datos en la lista privada…");
    try {
      const result = editingOwnerId
        ? await client.from("owners").update(payload).eq("id", editingOwnerId)
        : await client.from("owners").insert(payload);
      if (result.error) throw result.error;
      clearOwnerForm();
      await loadOwners();
    } catch (error) {
      status(ownersStatus, `No se pudo guardar el propietario: ${error.message || "revisa la conexión."}`, "error");
    } finally { submit.disabled = false; }
  }

  async function deleteOwner(id) {
    const owner = owners.find((item) => item.id === id);
    if (!owner || !window.confirm(`¿Eliminar los datos privados de ${owner.full_name}?`)) return;
    const { error } = await client.from("owners").delete().eq("id", id);
    if (error) {
      status(document.querySelector("#owners-status"), `No se pudo eliminar: ${error.message}`, "error");
      return;
    }
    if (editingOwnerId === id) clearOwnerForm();
    await loadOwners();
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

  async function optimizePhoto(file) {
    const image = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    const output = blob || await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!output) throw new Error(`No se pudo optimizar la foto ${file.name}. Prueba con otra imagen.`);
    const extension = output.type === "image/webp" ? ".webp" : ".jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    return new File([output], `${baseName}${extension}`, { type: output.type, lastModified: Date.now() });
  }

  async function optimizeVideo(file, index, total) {
    if (!("MediaRecorder" in window)) throw new Error("Este navegador no puede optimizar vídeos. Prueba con Brave o Firefox actualizado.");
    const sourceUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.playsInline = true;
    video.volume = 1;
    video.src = sourceUrl;
    let recorder = null;
    let captureSource = null;
    let stream = null;
    let audioContext = null;
    let audioDestination = null;
    let frameId = null;
    try {
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error("No se pudo leer el vídeo. Guarda o exporta el vídeo como MP4 y vuelve a intentarlo."));
      });
      if (!Number.isFinite(video.duration) || video.duration > 180) throw new Error("Cada vídeo debe durar 3 minutos o menos para poder optimizarlo automáticamente.");
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(2, Math.floor(video.videoWidth * scale / 2) * 2);
      canvas.height = Math.max(2, Math.floor(video.videoHeight * scale / 2) * 2);
      const context = canvas.getContext("2d", { alpha: false });
      const canvasStream = canvas.captureStream(24);
      captureSource = video.captureStream ? video.captureStream() : video.mozCaptureStream?.();
      if (!captureSource) throw new Error("Este navegador no permite optimizar vídeos. Prueba en Brave o Firefox actualizado.");
      let audioTracks = captureSource.getAudioTracks();
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        audioDestination = audioContext.createMediaStreamDestination();
        audioContext.createMediaElementSource(video).connect(audioDestination);
        await audioContext.resume();
        audioTracks = audioDestination.stream.getAudioTracks();
      }
      const tracks = [...canvasStream.getVideoTracks(), ...audioTracks];
      stream = new MediaStream(tracks);
      const mimeType = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("Este navegador no ofrece un formato de vídeo compatible para comprimir.");
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1600000, audioBitsPerSecond: 96000 });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const resultPromise = new Promise((resolve, reject) => {
        recorder.onerror = () => reject(new Error("No se pudo comprimir el vídeo. Prueba con otro archivo MP4 o WebM."));
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType.split(";")[0] }));
      });
      const drawFrame = () => {
        if (video.readyState >= 2 && !video.paused && !video.ended) context.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (!video.ended && recorder.state === "recording") frameId = requestAnimationFrame(drawFrame);
      };
      recorder.start(1000);
      frameId = requestAnimationFrame(drawFrame);
      status(formStatus, `Comprimiendo vídeo ${index} de ${total}: no cierres esta página (tarda aproximadamente lo que dura el vídeo)…`);
      video.onended = () => { if (recorder.state === "recording") recorder.stop(); };
      await video.play();
      const output = await resultPromise;
      cancelAnimationFrame(frameId);
      [...stream.getTracks(), ...captureSource.getTracks()].forEach((track) => track.stop());
      if (output.size > 48 * 1024 * 1024) throw new Error("El vídeo optimizado supera el límite gratuito de 48 MB. Usa un clip más corto.");
    const contentType = output.type.split(";")[0].toLowerCase();
    const extension = contentType === "video/mp4" ? ".mp4" : ".webm";
      const name = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9._-]/g, "-");
      return new File([output], `${name}${extension}`, { type: contentType, lastModified: Date.now() });
    } finally {
      if (recorder?.state === "recording") recorder.stop();
      if (frameId !== null) cancelAnimationFrame(frameId);
      [...(stream?.getTracks() || []), ...(captureSource?.getTracks() || [])].forEach((track) => track.stop());
      audioDestination?.stream.getTracks().forEach((track) => track.stop());
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      video.pause();
      video.removeAttribute("src");
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function uploadPhotos() {
    const uploaded = [];
    for (let index = 0; index < newFiles.length; index += 1) {
      const original = newFiles[index];
      const file = original.type.startsWith("video/")
        ? await optimizeVideo(original, index + 1, newFiles.length)
        : await optimizePhoto(original);
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error } = await client.storage.from(bucketName).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = client.storage.from(bucketName).getPublicUrl(path);
      uploaded.push({ url: data.publicUrl, path, type: file.type.startsWith("video/") ? "video" : "image" });
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
    status(formStatus, "Guardando la ficha y optimizando las fotografías…");
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
  ownerForm.addEventListener("submit", saveOwner);
  document.querySelector("#cancel-owner-edit").addEventListener("click", clearOwnerForm);
  document.querySelector("#owner-search").addEventListener("input", renderOwners);
  document.querySelector("#owner-list").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-owner]");
    const remove = event.target.closest("[data-delete-owner]");
    if (edit) {
      const owner = owners.find((item) => item.id === edit.dataset.editOwner);
      if (owner) editOwner(owner);
    }
    if (remove) deleteOwner(remove.dataset.deleteOwner);
  });
  document.querySelector("#cancel-edit").addEventListener("click", clearForm);
  document.querySelector("#new-property").addEventListener("click", () => { clearForm(); document.querySelector("#property-title").focus(); });
  document.querySelector("#property-search").addEventListener("input", renderProperties);

  photoInput.addEventListener("change", () => {
    const selected = Array.from(photoInput.files || []);
    const invalid = selected.find((file) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
      return file.size > (file.type.startsWith("video/") ? 80 : 25) * 1024 * 1024 || !allowed.includes(file.type);
    });
    if (invalid) {
      status(formStatus, "Usa fotos JPG, PNG o WebP (hasta 25 MB) o vídeos MP4, WebM o MOV (hasta 80 MB).", "error");
      photoInput.value = "";
      return;
    }
    newFiles.push(...selected);
    photoInput.value = "";
    renderPhotos();
  });

  heroPhotoInput.addEventListener("change", () => {
    const selected = Array.from(heroPhotoInput.files || []);
    const available = Math.max(0, 3 - heroPhotos.length - newHeroFiles.length);
    const invalid = selected.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 25 * 1024 * 1024);
    if (invalid) {
      status(document.querySelector("#site-content-status"), "Usa fotos JPG, PNG o WebP de hasta 25 MB.", "error");
    } else if (selected.length > available) {
      status(document.querySelector("#site-content-status"), `Puedes guardar hasta tres fotos de portada. Quita alguna antes de añadir más.`, "error");
    } else {
      newHeroFiles.push(...selected);
      renderHeroPhotos();
    }
    heroPhotoInput.value = "";
  });

  heroPhotoPreview.addEventListener("click", (event) => {
    const removeSaved = event.target.closest("[data-remove-hero-photo]");
    const removeNew = event.target.closest("[data-remove-new-hero-photo]");
    if (removeSaved) heroPhotos.splice(Number(removeSaved.dataset.removeHeroPhoto), 1);
    if (removeNew) newHeroFiles.splice(Number(removeNew.dataset.removeNewHeroPhoto), 1);
    if (removeSaved || removeNew) renderHeroPhotos();
  });

  document.querySelector("#custom-page-title").addEventListener("input", (event) => {
    const slugInput = document.querySelector("#custom-page-slug");
    if (!editingPageSlug || !slugInput.value) slugInput.value = pageSlug(event.currentTarget.value);
  });
  document.querySelector("#save-custom-page").addEventListener("click", () => {
    const title = document.querySelector("#custom-page-title").value.trim();
    const slug = pageSlug(document.querySelector("#custom-page-slug").value || title);
    const body = document.querySelector("#custom-page-body").value.trim();
    const rawImage = document.querySelector("#custom-page-image").value.trim();
    let image = "";
    if (rawImage) {
      try {
        const parsed = new URL(rawImage);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL no válida");
        image = parsed.href;
      } catch (_error) {
        status(document.querySelector("#site-content-status"), "La foto de cabecera debe tener un enlace web válido.", "error");
        return;
      }
    }
    if (!title || !slug || !body) {
      status(document.querySelector("#site-content-status"), "Escribe un título y el contenido de la página.", "error");
      return;
    }
    const duplicate = customPages.some((page) => page.slug === slug && page.slug !== editingPageSlug);
    if (duplicate) {
      status(document.querySelector("#site-content-status"), "Ya existe una página con esa dirección corta.", "error");
      return;
    }
    const nextPage = { title, slug, body, image };
    if (editingPageSlug) customPages = customPages.map((page) => page.slug === editingPageSlug ? nextPage : page);
    else customPages.push(nextPage);
    renderCustomPages();
    clearCustomPageForm();
    status(document.querySelector("#site-content-status"), "Página preparada. Pulsa “Guardar cambios” para publicarla.");
  });
  document.querySelector("#cancel-custom-page").addEventListener("click", clearCustomPageForm);
  document.querySelector("#custom-page-list").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-page]");
    const remove = event.target.closest("[data-remove-page]");
    if (edit) {
      const page = customPages.find((item) => item.slug === edit.dataset.editPage);
      if (!page) return;
      editingPageSlug = page.slug;
      document.querySelector("#custom-page-title").value = page.title;
      document.querySelector("#custom-page-slug").value = page.slug;
      document.querySelector("#custom-page-image").value = page.image || "";
      document.querySelector("#custom-page-body").value = page.body || "";
      document.querySelector("#save-custom-page").textContent = "Guardar página";
      document.querySelector("#cancel-custom-page").hidden = false;
      document.querySelector("#custom-page-title").focus();
    } else if (remove) {
      customPages = customPages.filter((page) => page.slug !== remove.dataset.removePage);
      if (editingPageSlug === remove.dataset.removePage) clearCustomPageForm();
      renderCustomPages();
      status(document.querySelector("#site-content-status"), "Página quitada. Pulsa “Guardar cambios” para guardar el cambio.");
    }
  });

  document.querySelector("#site-content-form").addEventListener("submit", saveSiteContent);
  document.querySelector("#add-review").addEventListener("click", () => {
    const name = document.querySelector("#new-review-name").value.trim();
    const text = document.querySelector("#new-review-text").value.trim();
    if (!name || !text) {
      status(document.querySelector("#site-content-status"), "Escribe el nombre y el texto de la reseña antes de añadirla.", "error");
      return;
    }
    reviews.push({ name, text });
    document.querySelector("#new-review-name").value = "";
    document.querySelector("#new-review-text").value = "";
    renderReviews();
  });
  document.querySelector("#review-list").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-review]");
    if (remove) { reviews.splice(Number(remove.dataset.removeReview), 1); renderReviews(); }
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

(() => {
  const STORAGE_KEY = "inmobiliaria-la-alcayna-manager-v1";
  const fallback = window.__propertyManagerData || { siteConfig: window.siteConfig || {}, properties: window.properties || [] };
  const inputs = {
    agencyName: document.querySelector("#agency-name"),
    whatsapp: document.querySelector("#agency-whatsapp"),
    email: document.querySelector("#agency-email"),
    phone: document.querySelector("#agency-phone")
  };
  const photoInput = document.querySelector("#property-photos");
  const photoPreview = document.querySelector("#photo-preview");
  const form = document.querySelector("#property-form");
  let config = { ...fallback.siteConfig, name: fallback.siteConfig?.name || "Inmobiliaria La Alcayna" };
  let properties = Array.isArray(fallback.properties) ? fallback.properties.map(normalizeProperty) : [];
  let photos = [];
  let editingId = null;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.properties)) {
      config = { ...config, ...(saved.siteConfig || {}) };
      properties = saved.properties.map(normalizeProperty);
    }
  } catch (_error) {
    // Si el navegador bloquea el almacenamiento, el gestor sigue funcionando durante esta sesión.
  }

  function normalizeProperty(property) {
    const images = Array.isArray(property.images) && property.images.length ? property.images : property.image ? [property.image] : [];
    return { ...property, images, image: images[0] || property.image || "", features: Array.isArray(property.features) ? property.features : [] };
  }

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
  const typeNames = { piso: "Piso", casa: "Casa / chalet", atico: "Ático", local: "Local", terreno: "Terreno" };
  const operationNames = { venta: "En venta", alquiler: "En alquiler" };
  const formatPrice = (price, operation) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Number(price) || 0)} €${operation === "alquiler" ? " / mes" : ""}`;

  function setStatus(message, kind = "") {
    const status = document.querySelector("#form-status");
    status.textContent = message;
    status.className = `manager-status ${kind ? `status-${kind}` : ""}`;
  }

  function persist(message = "Cambios guardados en este dispositivo.") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ siteConfig: config, properties }));
      document.querySelector("#manager-global-status").textContent = message;
      document.querySelector("#manager-global-status").className = "manager-global-status status-success";
      return true;
    } catch (_error) {
      document.querySelector("#manager-global-status").textContent = "El navegador no tiene espacio para guardar todos los datos. Descarga la actualización ahora para no perder las fotos.";
      document.querySelector("#manager-global-status").className = "manager-global-status status-error";
      return false;
    }
  }

  function syncSettings() {
    config = {
      ...config,
      name: inputs.agencyName.value.trim() || "Inmobiliaria La Alcayna",
      whatsapp: inputs.whatsapp.value.trim().replace(/\D/g, ""),
      email: inputs.email.value.trim(),
      phone: inputs.phone.value.trim()
    };
    document.querySelectorAll(".manager-brand strong, .manager-footer span").forEach((node) => { node.textContent = config.name; });
  }

  function fillSettings() {
    inputs.agencyName.value = config.name || "Inmobiliaria La Alcayna";
    inputs.whatsapp.value = config.whatsapp || "";
    inputs.email.value = config.email || "";
    inputs.phone.value = config.phone || "";
  }

  function renderPhotos() {
    photoPreview.innerHTML = photos.map((photo, index) => `
      <div class="photo-thumb">
        <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.name || `Foto ${index + 1}`)}" />
        <button type="button" data-remove-photo="${index}" aria-label="Quitar foto ${index + 1}">×</button>
        <span>${escapeHTML(photo.name || `Foto ${index + 1}`)}</span>
      </div>`).join("");
  }

  function renderProperties() {
    const query = document.querySelector("#property-search").value.trim().toLocaleLowerCase("es");
    const visible = properties.filter((property) => `${property.title} ${property.location}`.toLocaleLowerCase("es").includes(query));
    document.querySelector("#property-count").textContent = String(properties.length);
    document.querySelector("#empty-list").hidden = visible.length > 0;
    document.querySelector("#managed-list").innerHTML = visible.map((property) => `
      <article class="managed-card">
        ${property.images[0] ? `<img src="${escapeHTML(property.images[0])}" alt="" />` : "<div class=\"managed-image-empty\"></div>"}
        <div class="managed-card-copy"><strong>${escapeHTML(property.title)}</strong><span>${escapeHTML(property.location)} · ${formatPrice(property.price, property.operation)}</span></div>
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
    photoInput.value = "";
    renderPhotos();
    setStatus("");
  }

  function editProperty(property) {
    editingId = property.id;
    document.querySelector("#property-id").value = property.id;
    document.querySelector("#property-title").value = property.title || "";
    document.querySelector("#property-operation").value = property.operation || "venta";
    document.querySelector("#property-type").value = property.type || "casa";
    document.querySelector("#property-price").value = property.price ?? "";
    document.querySelector("#property-badge").value = property.badge === "Ejemplo" ? "" : (property.badge || "");
    document.querySelector("#property-location").value = property.location || "";
    document.querySelector("#property-address").value = property.address || "";
    document.querySelector("#property-map").value = property.mapUrl || "";
    document.querySelector("#property-area").value = property.area || "";
    document.querySelector("#property-bedrooms").value = property.bedrooms || "";
    document.querySelector("#property-bathrooms").value = property.bathrooms || "";
    document.querySelector("#property-parking").value = property.parking || "";
    document.querySelector("#property-description").value = property.description || "";
    document.querySelector("#property-features").value = (property.features || []).join("\n");
    photos = property.images.map((src, index) => ({ src, name: `Foto ${index + 1}` }));
    renderPhotos();
    document.querySelector("#form-heading").textContent = "Editar propiedad";
    document.querySelector("#save-property").innerHTML = "Guardar cambios <span>↗</span>";
    document.querySelector("#cancel-edit").hidden = false;
    setStatus("Editando esta ficha.");
    document.querySelector("#property-title").focus();
    window.scrollTo({ top: document.querySelector(".editor-panel").getBoundingClientRect().top + window.scrollY - 20, behavior: "smooth" });
  }

  async function compressPhoto(file) {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.76);
  }

  document.querySelectorAll(".business-settings input").forEach((input) => input.addEventListener("change", () => {
    syncSettings();
    persist("Datos de contacto guardados en este dispositivo.");
  }));
  inputs.agencyName.addEventListener("input", syncSettings);

  photoInput.addEventListener("change", async () => {
    const files = Array.from(photoInput.files || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    setStatus("Optimizando las fotos…");
    for (const file of files) {
      try {
        photos.push({ src: await compressPhoto(file), name: file.name });
      } catch (_error) {
        setStatus(`No se pudo cargar ${file.name}. Prueba con otra imagen.`, "error");
      }
    }
    renderPhotos();
    photoInput.value = "";
    if (!document.querySelector("#form-status").classList.contains("status-error")) setStatus(`${files.length} foto${files.length === 1 ? "" : "s"} preparada${files.length === 1 ? "" : "s"}.`);
  });

  photoPreview.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-photo]");
    if (!button) return;
    photos.splice(Number(button.dataset.removePhoto), 1);
    renderPhotos();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    syncSettings();
    const title = document.querySelector("#property-title").value.trim();
    const price = Number(document.querySelector("#property-price").value);
    const location = document.querySelector("#property-location").value.trim();
    if (!title || !location || price <= 0) {
      setStatus("Completa el título, la zona y un precio mayor que cero.", "error");
      return;
    }
    if (!photos.length) {
      setStatus("Añade al menos una fotografía para completar la ficha.", "error");
      return;
    }
    const operation = document.querySelector("#property-operation").value;
    const features = document.querySelector("#property-features").value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
    const property = {
      id: editingId || Date.now(),
      title,
      type: document.querySelector("#property-type").value,
      operation,
      price,
      location,
      address: document.querySelector("#property-address").value.trim(),
      mapUrl: document.querySelector("#property-map").value.trim(),
      bedrooms: Number(document.querySelector("#property-bedrooms").value) || 0,
      bathrooms: Number(document.querySelector("#property-bathrooms").value) || 0,
      area: Number(document.querySelector("#property-area").value) || 0,
      parking: Number(document.querySelector("#property-parking").value) || 0,
      badge: document.querySelector("#property-badge").value.trim() || (operationNames[operation] || "Disponible"),
      image: photos[0].src,
      images: photos.map((photo) => photo.src),
      imageAlt: title,
      features,
      description: document.querySelector("#property-description").value.trim()
    };
    if (editingId) properties = properties.map((item) => String(item.id) === String(editingId) ? property : item);
    else properties.unshift(property);
    renderProperties();
    persist("Ficha guardada en este dispositivo.");
    clearForm();
    document.querySelector("#manager-global-status").textContent = "Ficha guardada. Descarga la actualización para publicarla en la web.";
    document.querySelector("#manager-global-status").className = "manager-global-status status-success";
  });

  document.querySelector("#managed-list").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    if (editButton) {
      const property = properties.find((item) => String(item.id) === editButton.dataset.edit);
      if (property) editProperty(property);
    }
    if (deleteButton) {
      const property = properties.find((item) => String(item.id) === deleteButton.dataset.delete);
      if (property && window.confirm(`¿Eliminar “${property.title}”?`)) {
        properties = properties.filter((item) => String(item.id) !== deleteButton.dataset.delete);
        if (String(editingId) === String(property.id)) clearForm();
        renderProperties();
        persist(`“${property.title}” se ha eliminado de la lista de este dispositivo.`);
      }
    }
  });

  document.querySelector("#property-search").addEventListener("input", renderProperties);
  document.querySelector("#new-property").addEventListener("click", () => {
    clearForm();
    document.querySelector("#property-title").focus();
    window.scrollTo({ top: document.querySelector(".editor-panel").getBoundingClientRect().top + window.scrollY - 20, behavior: "smooth" });
  });
  document.querySelector("#cancel-edit").addEventListener("click", clearForm);

  document.querySelector("#download-data").addEventListener("click", () => {
    syncSettings();
    const payload = { siteConfig: config, properties };
    const source = `/* Datos de Inmobiliaria La Alcayna generados desde el gestor visual. */\nwindow.__propertyManagerData = ${JSON.stringify(payload, null, 2)};\nwindow.siteConfig = window.__propertyManagerData.siteConfig;\nwindow.properties = window.__propertyManagerData.properties;\n`;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "datos.js";
    link.click();
    URL.revokeObjectURL(url);
    persist("Archivo descargado. Súbelo a GitHub sustituyendo el datos.js actual para publicar.");
  });

  const importFile = document.querySelector("#import-file");
  document.querySelector("#import-data").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const assignment = "window.__propertyManagerData =";
      const start = text.indexOf(assignment);
      const tail = start < 0 ? null : text.slice(start).match(/;\s*window\.siteConfig/);
      const end = tail ? start + tail.index : -1;
      if (start < 0 || end < 0) throw new Error("Archivo no reconocido");
      const imported = JSON.parse(text.slice(start + assignment.length, end).trim());
      if (!Array.isArray(imported.properties) || !imported.siteConfig) throw new Error("Faltan datos de propiedades");
      config = { ...config, ...imported.siteConfig };
      properties = imported.properties.map(normalizeProperty);
      fillSettings();
      clearForm();
      renderProperties();
      persist("Archivo importado y guardado en este dispositivo.");
    } catch (_error) {
      document.querySelector("#manager-global-status").textContent = "No se pudo importar. Elige un archivo datos.js descargado desde este gestor.";
      document.querySelector("#manager-global-status").className = "manager-global-status status-error";
    }
    importFile.value = "";
  });

  fillSettings();
  renderProperties();
})();

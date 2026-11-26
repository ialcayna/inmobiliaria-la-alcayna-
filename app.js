(() => {
  const config = window.siteConfig || {};
  const properties = Array.isArray(window.properties) ? window.properties : [];
  const grid = document.querySelector("#property-grid");
  const operationFilter = document.querySelector("#operation-filter");
  const typeFilter = document.querySelector("#type-filter");
  const searchInput = document.querySelector("#search-input");
  const sortFilter = document.querySelector("#sort-filter");
  const resultsCount = document.querySelector("#results-count");
  const emptyState = document.querySelector("#empty-state");
  const demoNote = document.querySelector("#demo-note");
  const propertyDialog = document.querySelector("#property-dialog");
  let galleryImages = [];
  let galleryIndex = 0;
  const whatsappNumber = String(config.whatsapp || "").replace(/\D/g, "");
  let selectedProperty = null;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);

  const formatPrice = (price, operation) => {
    const formatted = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Number(price) || 0);
    return `${formatted} €${operation === "alquiler" ? " / mes" : ""}`;
  };

  const typeNames = { piso: "Piso", casa: "Casa", atico: "Ático", local: "Local", terreno: "Terreno" };
  const operationNames = { venta: "En venta", alquiler: "En alquiler" };
  const propertyImages = (property) => Array.isArray(property.images) && property.images.length ? property.images : property.image ? [property.image] : [];
  const contactHint = () => whatsappNumber
    ? "Al enviar, se abrirá WhatsApp con tu mensaje preparado."
    : config.email
      ? "Al enviar, se abrirá tu correo con la consulta preparada."
      : "Configura un WhatsApp o correo en el gestor para recibir consultas.";

  document.querySelectorAll("[data-brand]").forEach((node) => { node.textContent = config.name || "Tu inmobiliaria"; });
  document.title = `${config.name || "Inmobiliaria"} | Hogares con historia`;
  document.querySelector("#year").textContent = new Date().getFullYear();

  const showGalleryImage = () => {
    const image = document.querySelector("#dialog-image");
    image.src = galleryImages[galleryIndex] || "";
    image.alt = selectedProperty?.imageAlt || selectedProperty?.title || "Fotografía de la propiedad";
    document.querySelector("#gallery-count").textContent = galleryImages.length > 1 ? `${galleryIndex + 1} / ${galleryImages.length}` : "";
    document.querySelector("#gallery-prev").hidden = galleryImages.length < 2;
    document.querySelector("#gallery-next").hidden = galleryImages.length < 2;
  };

  const openProperty = (property) => {
    selectedProperty = property;
    galleryImages = propertyImages(property);
    galleryIndex = 0;
    document.querySelector("#dialog-kicker").textContent = `${typeNames[property.type] || "Propiedad"} · ${operationNames[property.operation] || "Disponible"}`;
    document.querySelector("#dialog-title").textContent = property.title || "Ficha de propiedad";
    document.querySelector("#dialog-location").textContent = [property.location, property.address].filter(Boolean).join(" · ");
    document.querySelector("#dialog-price").textContent = formatPrice(property.price, property.operation);
    document.querySelector("#dialog-description").textContent = property.description || "Consulta con nosotros para conocer más detalles de esta propiedad.";
    const specItems = [[property.bedrooms, "dormitorios"], [property.bathrooms, "baños"], [property.area, "m²"], [property.parking, "plazas de parking"]]
      .filter(([value]) => Number(value) > 0)
      .map(([value, label]) => `<span><strong>${escapeHTML(value)}</strong> ${escapeHTML(label)}</span>`);
    document.querySelector("#dialog-specs").innerHTML = specItems.join("");
    const features = Array.isArray(property.features) ? property.features.filter(Boolean) : [];
    document.querySelector("#dialog-features").innerHTML = features.length
      ? features.map((feature) => `<li>${escapeHTML(feature)}</li>`).join("")
      : "<li>Consulta para más información</li>";
    const mapLink = document.querySelector("#dialog-map");
    const safeMapUrl = /^https?:\/\//i.test(property.mapUrl || "");
    mapLink.hidden = !safeMapUrl;
    if (safeMapUrl) mapLink.href = property.mapUrl;
    document.querySelector("#form-help").textContent = `Consulta seleccionada: ${property.title}. ${contactHint()}`;
    showGalleryImage();
    propertyDialog.showModal();
  };

  const filteredProperties = () => {
    const operation = operationFilter.value;
    const type = typeFilter.value;
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    let result = properties.filter((property) => {
      const matchesOperation = operation === "all" || property.operation === operation;
      const matchesType = type === "all" || property.type === type;
      const searchable = `${property.title} ${property.location} ${property.description} ${property.type}`.toLocaleLowerCase("es");
      return matchesOperation && matchesType && (!query || searchable.includes(query));
    });
    if (sortFilter.value === "price-asc") result = result.sort((a, b) => a.price - b.price);
    if (sortFilter.value === "price-desc") result = result.sort((a, b) => b.price - a.price);
    return result;
  };

  const renderProperties = () => {
    const matches = filteredProperties();
    grid.innerHTML = matches.map((property) => {
      const specs = [
        Number(property.bedrooms) > 0 ? `<span>${escapeHTML(property.bedrooms)} hab.</span>` : "",
        Number(property.bathrooms) > 0 ? `<span>${escapeHTML(property.bathrooms)} baños</span>` : "",
        Number(property.area) > 0 ? `<span>${escapeHTML(property.area)} m²</span>` : ""
      ].filter(Boolean).join("");
      return `
      <article class="property-card">
        <button class="property-photo" type="button" data-property-id="${escapeHTML(property.id)}" aria-label="Ver ficha de ${escapeHTML(property.title)}" style="background-image:url('${escapeHTML(propertyImages(property)[0] || property.image || "") }')">
          <span class="property-badge">${escapeHTML(property.badge || operationNames[property.operation] || "Disponible")}</span>
          <span class="photo-arrow" aria-hidden="true">↗</span>
        </button>
        <div class="property-info">
          <div class="property-meta"><span>${escapeHTML(typeNames[property.type] || "Propiedad")}</span><span class="meta-dot"></span><span>${escapeHTML(operationNames[property.operation] || "Disponible")}</span></div>
          <h3>${escapeHTML(property.title)}</h3>
          <p class="property-location"><span aria-hidden="true">⌖</span> ${escapeHTML(property.location)}</p>
          <div class="property-bottom"><div class="property-specs">${specs}</div><strong>${formatPrice(property.price, property.operation)}</strong></div>
          <button class="details-link" type="button" data-property-id="${escapeHTML(property.id)}">Ver ficha y fotos <span aria-hidden="true">↗</span></button>
        </div>
      </article>`;
    }).join("");
    resultsCount.textContent = `${matches.length} ${matches.length === 1 ? "propiedad" : "propiedades"}`;
    emptyState.hidden = matches.length > 0;
    demoNote.hidden = !properties.some((property) => String(property.badge || "").toLocaleLowerCase("es").includes("ejemplo"));
  };

  [operationFilter, typeFilter, sortFilter].forEach((control) => control.addEventListener("change", renderProperties));
  grid.addEventListener("click", (event) => {
    const propertyLink = event.target.closest("[data-property-id]");
    if (!propertyLink) return;
    const property = properties.find((item) => String(item.id) === propertyLink.dataset.propertyId);
    if (property) openProperty(property);
  });
  document.querySelector("#dialog-close").addEventListener("click", () => propertyDialog.close());
  document.querySelector("#gallery-prev").addEventListener("click", () => {
    galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length;
    showGalleryImage();
  });
  document.querySelector("#gallery-next").addEventListener("click", () => {
    galleryIndex = (galleryIndex + 1) % galleryImages.length;
    showGalleryImage();
  });
  document.querySelector("#dialog-contact").addEventListener("click", () => propertyDialog.close());
  document.querySelector("#search-button").addEventListener("click", renderProperties);
  searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") renderProperties(); });
  document.querySelector("#clear-filters").addEventListener("click", () => {
    operationFilter.value = "all";
    typeFilter.value = "all";
    searchInput.value = "";
    sortFilter.value = "featured";
    renderProperties();
  });

  const detailItems = [];
  if (config.phone) detailItems.push(`<a href="tel:${escapeHTML(config.phone)}">${escapeHTML(config.phone)}</a>`);
  if (config.email) detailItems.push(`<a href="mailto:${escapeHTML(config.email)}">${escapeHTML(config.email)}</a>`);
  if (detailItems.length) document.querySelector("#contact-details").innerHTML = detailItems.join("");
  else document.querySelector("#contact-details").innerHTML = `<span class="contact-setup">Añade tu teléfono o correo en <strong>datos.js</strong> para mostrar aquí tus datos de contacto.</span>`;

  document.querySelector("#contact-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("nombre");
    const phone = form.get("telefono");
    const reason = form.get("motivo");
    const message = form.get("mensaje");
    const propertyText = selectedProperty ? ` Me interesa la propiedad: ${selectedProperty.title} (${selectedProperty.location}).` : "";
    const text = `Hola, soy ${name}. Mi teléfono es ${phone}. ${reason}.${propertyText}${message ? ` ${message}` : ""}`;
    if (whatsappNumber) {
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (config.email) {
      const subject = selectedProperty ? `Consulta sobre ${selectedProperty.title}` : "Consulta desde la web inmobiliaria";
      window.location.href = `mailto:${config.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      return;
    }
    document.querySelector("#form-help").textContent = contactHint();
  });

  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#main-nav");
  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("is-open", !expanded);
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    menuButton.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  }));

  document.querySelector("#form-help").textContent = contactHint();
  renderProperties();
})();

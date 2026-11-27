(() => {
  const config = window.siteConfig || {};
  let properties = Array.isArray(window.properties) ? window.properties : [];
  const cloudConfig = window.supabaseConfig || {};
  const cloudReady = Boolean(cloudConfig.url && cloudConfig.publishableKey && window.supabase?.createClient);
  const cloudClient = cloudReady ? window.supabase.createClient(cloudConfig.url, cloudConfig.publishableKey) : null;
  if (cloudReady) properties = [];
  const grid = document.querySelector("#property-grid");
  const operationFilter = document.querySelector("#operation-filter");
  const typeFilter = document.querySelector("#type-filter");
  const searchInput = document.querySelector("#search-input");
  const sortFilter = document.querySelector("#sort-filter");
  const resultsCount = document.querySelector("#results-count");
  const emptyState = document.querySelector("#empty-state");
  const demoNote = document.querySelector("#demo-note");
  const propertyDialog = document.querySelector("#property-dialog");
  const photoLightbox = document.querySelector("#photo-lightbox");
  const dialogGallery = document.querySelector(".dialog-gallery");
  const galleryToggle = document.querySelector("#gallery-toggle");
  const galleryThumbnails = document.querySelector("#gallery-thumbnails");
  const zoomImage = document.querySelector("#zoom-image");
  let galleryImages = [];
  let galleryIndex = 0;
  let galleryTimer = null;
  let galleryPaused = false;
  const whatsappNumber = String(config.whatsapp || "").replace(/\D/g, "");
  let selectedProperty = null;
  let showFavorites = false;
  let favoriteIds = new Set();
  try { favoriteIds = new Set(JSON.parse(localStorage.getItem("la-alcayna-favorites") || "[]").map(String)); } catch (_error) { favoriteIds = new Set(); }

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);

  const formatPrice = (price, operation) => {
    const formatted = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(Number(price) || 0);
    return `${formatted} €${operation === "alquiler" ? " / mes" : ""}`;
  };

  const fromDatabase = (row) => {
    const images = Array.isArray(row.images) ? row.images.map((item) => typeof item === "string" ? item : item.url).filter(Boolean) : [];
    return {
      ...row,
      mapUrl: row.map_url || "",
      bedrooms: row.bedrooms || 0,
      bathrooms: row.bathrooms || 0,
      area: row.area || 0,
      parking: row.parking || 0,
      images,
      image: images[0] || "",
      imageAlt: row.title
    };
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
    image.classList.remove("gallery-reveal");
    void image.offsetWidth;
    image.src = galleryImages[galleryIndex] || "";
    image.alt = selectedProperty?.imageAlt || selectedProperty?.title || "Fotografía de la propiedad";
    image.classList.add("gallery-reveal");
    document.querySelector("#gallery-count").textContent = galleryImages.length > 1 ? `${galleryIndex + 1} / ${galleryImages.length}` : "";
    document.querySelector("#gallery-prev").hidden = galleryImages.length < 2;
    document.querySelector("#gallery-next").hidden = galleryImages.length < 2;
    galleryToggle.hidden = galleryImages.length < 2;
    document.querySelector("#gallery-fullscreen").hidden = galleryImages.length < 2 || !dialogGallery.requestFullscreen;
    dialogGallery.classList.toggle("has-thumbnails", galleryImages.length > 1);
    if (galleryThumbnails.children.length !== galleryImages.length) {
      galleryThumbnails.replaceChildren(...galleryImages.map((src, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gallery-thumb";
        button.dataset.galleryIndex = String(index);
        button.setAttribute("aria-label", `Ver foto ${index + 1}`);
        button.setAttribute("aria-pressed", "false");
        const thumbnail = document.createElement("img");
        thumbnail.src = src;
        thumbnail.alt = "";
        button.append(thumbnail);
        return button;
      }));
    }
    [...galleryThumbnails.children].forEach((button, index) => {
      const isCurrent = index === galleryIndex;
      const thumbnail = button.querySelector("img");
      if (thumbnail.getAttribute("src") !== galleryImages[index]) thumbnail.src = galleryImages[index];
      button.classList.toggle("is-active", isCurrent);
      button.setAttribute("aria-pressed", String(isCurrent));
    });
    if (photoLightbox.open) showLightboxImage();
  };

  const showLightboxImage = () => {
    const image = document.querySelector("#lightbox-image");
    image.src = galleryImages[galleryIndex] || "";
    image.alt = selectedProperty?.imageAlt || selectedProperty?.title || "Fotografía de la propiedad";
    document.querySelector("#lightbox-count").textContent = galleryImages.length > 1 ? `${galleryIndex + 1} / ${galleryImages.length}` : "";
    document.querySelector("#lightbox-prev").hidden = galleryImages.length < 2;
    document.querySelector("#lightbox-next").hidden = galleryImages.length < 2;
  };

  const moveGallery = (direction) => {
    if (galleryImages.length < 2) return;
    galleryIndex = (galleryIndex + direction + galleryImages.length) % galleryImages.length;
    showGalleryImage();
  };

  const updateGalleryPlayback = () => {
    if (galleryTimer) window.clearInterval(galleryTimer);
    galleryTimer = null;
    const canPlay = galleryImages.length > 1 && !galleryPaused && propertyDialog.open;
    galleryToggle.textContent = galleryPaused ? "▶" : "Ⅱ";
    galleryToggle.setAttribute("aria-label", galleryPaused ? "Reanudar pase de fotos" : "Pausar pase de fotos");
    galleryToggle.setAttribute("aria-pressed", String(galleryPaused));
    if (canPlay) {
      galleryTimer = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        galleryIndex = (galleryIndex + 1) % galleryImages.length;
        showGalleryImage();
      }, 4500);
    }
  };

  const heroPictures = [
    { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=90", alt: "Casa luminosa rodeada de vegetación" },
    { src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=90", alt: "Casa contemporánea con jardín" },
    { src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=90", alt: "Salón sereno con luz natural" }
  ];
  const heroImage = document.querySelector("#hero-image");
  const heroSlides = [document.querySelector("#hero-slide-a"), document.querySelector("#hero-slide-b")];
  const heroDots = [...document.querySelectorAll("#hero-dots button")];
  const heroToggle = document.querySelector("#hero-toggle");
  const heroIndex = document.querySelector("#hero-index");
  let heroCurrent = 0;
  let heroPaused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let heroPointerPaused = false;
  let heroFocusPaused = false;
  heroSlides[0].src = heroPictures[0].src;
  heroSlides[1].src = heroPictures[1].src;

  const updateHeroControls = () => {
    heroDots.forEach((dot, index) => dot.setAttribute("aria-current", String(index === heroCurrent)));
    heroIndex.innerHTML = `${String(heroCurrent + 1).padStart(2, "0")} <span>/</span> ${String(heroPictures.length).padStart(2, "0")}`;
    heroToggle.textContent = heroPaused ? "▶" : "Ⅱ";
    heroToggle.setAttribute("aria-label", heroPaused ? "Reanudar imágenes" : "Pausar imágenes");
    heroToggle.setAttribute("aria-pressed", String(heroPaused));
  };

  const showHeroSlide = (index) => {
    const targetIndex = (index + heroPictures.length) % heroPictures.length;
    if (targetIndex === heroCurrent) return;
    const nextSlide = heroSlides.find((slide) => !slide.classList.contains("is-active"));
    const picture = heroPictures[targetIndex];
    nextSlide.onload = () => {
      nextSlide.onload = null;
      requestAnimationFrame(() => {
        nextSlide.classList.add("is-active");
        heroSlides.forEach((slide) => { if (slide !== nextSlide) slide.classList.remove("is-active"); });
        heroCurrent = targetIndex;
        heroImage.setAttribute("aria-label", picture.alt);
        updateHeroControls();
      });
    };
    nextSlide.src = picture.src;
    if (nextSlide.complete && nextSlide.naturalWidth) nextSlide.onload();
  };

  heroDots.forEach((dot, index) => dot.addEventListener("click", () => showHeroSlide(index)));
  heroToggle.addEventListener("click", () => { heroPaused = !heroPaused; updateHeroControls(); });
  const heroControls = document.querySelector(".hero-controls");
  heroControls.addEventListener("pointerenter", () => { heroPointerPaused = true; });
  heroControls.addEventListener("pointerleave", () => { heroPointerPaused = false; });
  heroControls.addEventListener("focusin", () => { heroFocusPaused = true; });
  heroControls.addEventListener("focusout", (event) => {
    if (!heroControls.contains(event.relatedTarget)) heroFocusPaused = false;
  });
  window.setInterval(() => {
    if (!heroPaused && !heroPointerPaused && !heroFocusPaused && document.visibilityState === "visible") showHeroSlide(heroCurrent + 1);
  }, 6000);
  updateHeroControls();

  const openProperty = (property, updateAddress = true) => {
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
    galleryPaused = false;
    showGalleryImage();
    propertyDialog.showModal();
    updateGalleryPlayback();
    if (updateAddress) {
      const url = new URL(window.location.href);
      url.searchParams.set("inmueble", property.id);
      window.history.replaceState({}, "", url);
    }
  };

  const openSharedProperty = () => {
    const linkedId = new URLSearchParams(window.location.search).get("inmueble");
    const property = properties.find((item) => String(item.id) === String(linkedId));
    if (property && !propertyDialog.open) openProperty(property, false);
  };

  const filteredProperties = () => {
    const operation = operationFilter.value;
    const type = typeFilter.value;
    const query = searchInput.value.trim().toLocaleLowerCase("es");
    let result = properties.filter((property) => {
      const matchesOperation = operation === "all" || property.operation === operation;
      const matchesType = type === "all" || property.type === type;
      const matchesFavorite = !showFavorites || favoriteIds.has(String(property.id));
      const searchable = `${property.title} ${property.location} ${property.description} ${property.type}`.toLocaleLowerCase("es");
      return matchesOperation && matchesType && matchesFavorite && (!query || searchable.includes(query));
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
        <button class="property-favorite ${favoriteIds.has(String(property.id)) ? "is-favorite" : ""}" type="button" data-favorite="${escapeHTML(property.id)}" aria-label="${favoriteIds.has(String(property.id)) ? "Quitar de" : "Añadir a"} favoritos" aria-pressed="${favoriteIds.has(String(property.id))}">${favoriteIds.has(String(property.id)) ? "♥" : "♡"}</button>
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
  document.querySelector("#favorites-filter").addEventListener("click", (event) => {
    showFavorites = !showFavorites;
    event.currentTarget.setAttribute("aria-pressed", String(showFavorites));
    event.currentTarget.classList.toggle("is-active", showFavorites);
    event.currentTarget.innerHTML = `${showFavorites ? "♥" : "♡"} ${showFavorites ? "Ver todos" : "Mis favoritos"}`;
    renderProperties();
  });
  grid.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest("[data-favorite]");
    if (favoriteButton) {
      const id = String(favoriteButton.dataset.favorite);
      if (favoriteIds.has(id)) favoriteIds.delete(id);
      else favoriteIds.add(id);
      try { localStorage.setItem("la-alcayna-favorites", JSON.stringify([...favoriteIds])); } catch (_error) { /* Los favoritos seguirán activos durante esta sesión. */ }
      renderProperties();
      return;
    }
    const propertyLink = event.target.closest("[data-property-id]");
    if (!propertyLink) return;
    const property = properties.find((item) => String(item.id) === propertyLink.dataset.propertyId);
    if (property) openProperty(property);
  });
  document.querySelector("#dialog-close").addEventListener("click", () => propertyDialog.close());
  propertyDialog.addEventListener("close", () => {
    if (galleryTimer) window.clearInterval(galleryTimer);
    galleryTimer = null;
    galleryPaused = false;
    if (document.fullscreenElement === dialogGallery) document.exitFullscreen();
    const url = new URL(window.location.href);
    url.searchParams.delete("inmueble");
    window.history.replaceState({}, "", url);
  });
  galleryToggle.addEventListener("click", () => { galleryPaused = !galleryPaused; updateGalleryPlayback(); });
  document.querySelector("#gallery-fullscreen").addEventListener("click", async () => {
    if (document.fullscreenElement === dialogGallery) await document.exitFullscreen();
    else if (dialogGallery.requestFullscreen) await dialogGallery.requestFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    const button = document.querySelector("#gallery-fullscreen");
    button.hidden = galleryImages.length < 2 || !dialogGallery.requestFullscreen;
    button.setAttribute("aria-label", document.fullscreenElement === dialogGallery ? "Salir de pantalla completa" : "Ampliar fotos a pantalla completa");
  });
  galleryThumbnails.addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-gallery-index]");
    if (!thumb) return;
    galleryIndex = Number(thumb.dataset.galleryIndex);
    showGalleryImage();
  });
  zoomImage.addEventListener("click", () => {
    showLightboxImage();
    photoLightbox.showModal();
  });
  document.querySelector("#lightbox-close").addEventListener("click", () => photoLightbox.close());
  document.querySelector("#lightbox-prev").addEventListener("click", () => moveGallery(-1));
  document.querySelector("#lightbox-next").addEventListener("click", () => moveGallery(1));
  photoLightbox.addEventListener("click", (event) => { if (event.target === photoLightbox) photoLightbox.close(); });
  let touchStartX = null;
  dialogGallery.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  dialogGallery.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const difference = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(difference) > 45) moveGallery(difference < 0 ? 1 : -1);
    touchStartX = null;
  }, { passive: true });
  let lightboxTouchStartX = null;
  photoLightbox.addEventListener("touchstart", (event) => { lightboxTouchStartX = event.changedTouches[0].clientX; }, { passive: true });
  photoLightbox.addEventListener("touchend", (event) => {
    if (lightboxTouchStartX === null) return;
    const difference = event.changedTouches[0].clientX - lightboxTouchStartX;
    if (Math.abs(difference) > 45) moveGallery(difference < 0 ? 1 : -1);
    lightboxTouchStartX = null;
  }, { passive: true });
  document.addEventListener("keydown", (event) => {
    if ((!propertyDialog.open && !photoLightbox.open) || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    moveGallery(event.key === "ArrowRight" ? 1 : -1);
  });
  document.querySelector("#share-buttons").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-share]");
    if (!button || !selectedProperty) return;
    const url = new URL(window.location.href);
    url.searchParams.set("inmueble", selectedProperty.id);
    const shareUrl = url.toString();
    const title = selectedProperty.title;
    const text = `${title} · ${formatPrice(selectedProperty.price, selectedProperty.operation)} · ${selectedProperty.location}`;
    const network = button.dataset.share;
    const shareStatus = document.querySelector("#share-status");
    if (network === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (network === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer,width=640,height=520");
      return;
    }
    if (navigator.share) {
      try { await navigator.share({ title, text, url: shareUrl }); } catch (_error) { /* El usuario puede cerrar el menú de compartir. */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      shareStatus.textContent = `Enlace copiado. Pégalo en tu publicación de ${network === "instagram" ? "Instagram" : "TikTok"}.`;
    } catch (_error) {
      window.prompt("Copia el enlace de esta propiedad:", shareUrl);
    }
  });
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
    showFavorites = false;
    document.querySelector("#favorites-filter").setAttribute("aria-pressed", "false");
    document.querySelector("#favorites-filter").classList.remove("is-active");
    document.querySelector("#favorites-filter").innerHTML = "♡ Mis favoritos";
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
  if (cloudClient) {
    cloudClient.from("properties").select("*").eq("is_published", true).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) {
        resultsCount.textContent = "No se pudieron cargar las propiedades. Vuelve a intentarlo más tarde.";
        return;
      }
      properties = (data || []).map(fromDatabase);
      renderProperties();
      openSharedProperty();
    });
  } else openSharedProperty();
})();

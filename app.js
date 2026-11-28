(() => {
  const config = window.siteConfig || {};
  let properties = Array.isArray(window.properties) ? window.properties : [];
  const cloudConfig = window.supabaseConfig || {};
  const cloudReady = Boolean(cloudConfig.url && cloudConfig.publishableKey && window.supabase?.createClient);
  const cloudClient = cloudReady ? window.supabase.createClient(cloudConfig.url, cloudConfig.publishableKey) : null;
  let propertyDataLoaded = !cloudClient;
  let propertyLoadError = false;
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
  const dialogVideo = document.querySelector("#dialog-video");
  let galleryImages = [];
  let galleryIndex = 0;
  let galleryTimer = null;
  let galleryPaused = false;
  let whatsappNumber = String(config.whatsapp || "").replace(/\D/g, "");
  let contactEmail = config.email || "";
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
    const images = Array.isArray(row.images) ? row.images.map((item) => {
      const media = typeof item === "string" ? { url: item } : item;
      if (!media?.url) return null;
      const type = media.type || (/\.(mp4|webm|mov)(\?|$)/i.test(media.url) ? "video" : "image");
      return { ...media, type };
    }).filter(Boolean) : [];
    return {
      ...row,
      mapUrl: row.map_url || "",
      bedrooms: row.bedrooms || 0,
      bathrooms: row.bathrooms || 0,
      area: row.area || 0,
      parking: row.parking || 0,
      images,
      image: images.find((item) => item.type === "image")?.url || "",
      imageAlt: row.title
    };
  };

  const typeNames = { piso: "Piso", casa: "Casa", atico: "Ático", local: "Local", terreno: "Terreno" };
  const operationNames = { venta: "En venta", alquiler: "En alquiler" };
  const propertyImages = (property) => {
    const media = Array.isArray(property.images) ? property.images.map((item) => {
      const normalized = typeof item === "string" ? { url: item } : item;
      return normalized?.url ? { ...normalized, type: normalized.type || (/\.(mp4|webm|mov)(\?|$)/i.test(normalized.url) ? "video" : "image") } : null;
    }).filter(Boolean) : [];
    return media.length ? media : property.image ? [{ url: property.image, type: "image" }] : [];
  };
  const contactHint = () => whatsappNumber
    ? "Al enviar, se abrirá WhatsApp con tu mensaje preparado."
    : config.email
      ? "Al enviar, se abrirá tu correo con la consulta preparada."
      : "Configura un WhatsApp o correo en el gestor para recibir consultas.";

  document.querySelectorAll("[data-brand]").forEach((node) => { node.textContent = config.name || "Tu inmobiliaria"; });
  document.title = `${config.name || "Inmobiliaria"} | Hogares con historia`;
  document.querySelector("#year").textContent = new Date().getFullYear();

  const showGalleryImage = () => {
    const media = galleryImages[galleryIndex] || { url: "", type: "image" };
    const image = document.querySelector("#dialog-image");
    if (media.type === "video") {
      image.hidden = true;
      zoomImage.hidden = true;
      dialogVideo.hidden = false;
      if (dialogVideo.src !== media.url) { dialogVideo.src = media.url; dialogVideo.load(); }
      if (galleryTimer) window.clearInterval(galleryTimer);
      galleryTimer = null;
    } else {
      dialogVideo.pause();
      dialogVideo.hidden = true;
      dialogVideo.removeAttribute("src");
      image.hidden = false;
      zoomImage.hidden = false;
      image.classList.remove("gallery-reveal");
      void image.offsetWidth;
      image.src = media.url;
      image.alt = selectedProperty?.imageAlt || selectedProperty?.title || "Fotografía de la propiedad";
      image.classList.add("gallery-reveal");
    }
    document.querySelector("#gallery-count").textContent = galleryImages.length > 1 ? `${galleryIndex + 1} / ${galleryImages.length}` : "";
    document.querySelector("#gallery-prev").hidden = galleryImages.length < 2;
    document.querySelector("#gallery-next").hidden = galleryImages.length < 2;
    galleryToggle.hidden = galleryImages.length < 2;
    document.querySelector("#gallery-fullscreen").hidden = galleryImages.length < 2 || !dialogGallery.requestFullscreen;
    dialogGallery.classList.toggle("has-thumbnails", galleryImages.length > 1);
    if (galleryThumbnails.children.length !== galleryImages.length) {
      galleryThumbnails.replaceChildren(...galleryImages.map((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gallery-thumb";
        button.dataset.galleryIndex = String(index);
        button.setAttribute("aria-label", `Ver foto ${index + 1}`);
        button.setAttribute("aria-pressed", "false");
        const thumbnail = item.type === "video" ? document.createElement("video") : document.createElement("img");
        thumbnail.src = item.url;
        thumbnail.alt = item.type === "video" ? "Vídeo" : "";
        if (item.type === "video") { thumbnail.muted = true; thumbnail.playsInline = true; thumbnail.preload = "metadata"; }
        button.append(thumbnail);
        return button;
      }));
    }
    [...galleryThumbnails.children].forEach((button, index) => {
      const isCurrent = index === galleryIndex;
      const thumbnail = button.querySelector("img, video");
      if (thumbnail.getAttribute("src") !== galleryImages[index].url) thumbnail.src = galleryImages[index].url;
      button.classList.toggle("is-active", isCurrent);
      button.setAttribute("aria-pressed", String(isCurrent));
    });
    if (photoLightbox.open && media.type === "video") photoLightbox.close();
    else if (photoLightbox.open) showLightboxImage();
  };

  const showLightboxImage = () => {
    const image = document.querySelector("#lightbox-image");
    image.src = galleryImages[galleryIndex]?.url || "";
    image.alt = selectedProperty?.imageAlt || selectedProperty?.title || "Fotografía de la propiedad";
    document.querySelector("#lightbox-count").textContent = galleryImages.length > 1 ? `${galleryIndex + 1} / ${galleryImages.length}` : "";
    document.querySelector("#lightbox-prev").hidden = galleryImages.length < 2;
    document.querySelector("#lightbox-next").hidden = galleryImages.length < 2;
  };

  const moveGallery = (direction) => {
    if (galleryImages.length < 2) return;
    galleryIndex = (galleryIndex + direction + galleryImages.length) % galleryImages.length;
    showGalleryImage();
    updateGalleryPlayback();
  };

  const updateGalleryPlayback = () => {
    if (galleryTimer) window.clearInterval(galleryTimer);
    galleryTimer = null;
    const canPlay = galleryImages.length > 1 && galleryImages[galleryIndex]?.type !== "video" && !galleryPaused && propertyDialog.open;
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

  const defaultHeroPictures = [
    { src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2200&q=90", alt: "Casa luminosa rodeada de vegetación" },
    { src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=90", alt: "Casa contemporánea con jardín" },
    { src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=90", alt: "Salón sereno con luz natural" }
  ];
  let heroPictures = defaultHeroPictures;
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
    heroDots.forEach((dot, index) => {
      dot.hidden = index >= heroPictures.length;
      if (index < heroPictures.length) dot.setAttribute("aria-current", String(index === heroCurrent));
    });
    heroIndex.innerHTML = `${String(heroCurrent + 1).padStart(2, "0")} <span>/</span> ${String(heroPictures.length).padStart(2, "0")}`;
    heroToggle.hidden = heroPictures.length < 2;
    heroToggle.textContent = heroPaused ? "▶" : "Ⅱ";
    heroToggle.setAttribute("aria-label", heroPaused ? "Reanudar imágenes" : "Pausar imágenes");
    heroToggle.setAttribute("aria-pressed", String(heroPaused));
  };

  const applyHeroPictures = (images) => {
    const custom = Array.isArray(images) ? images.map((item, index) => {
      const src = typeof item === "string" ? item : item?.url || item?.src || "";
      return /^https?:\/\//i.test(src) ? { src, alt: typeof item === "object" && item.alt ? item.alt : `Imagen de portada ${index + 1}` } : null;
    }).filter(Boolean).slice(0, 3) : [];
    heroPictures = custom.length ? custom : defaultHeroPictures;
    heroCurrent = 0;
    heroSlides.forEach((slide, index) => {
      slide.onload = null;
      slide.src = heroPictures[Math.min(index, heroPictures.length - 1)].src;
      slide.classList.toggle("is-active", index === 0);
    });
    heroImage.setAttribute("aria-label", heroPictures[0].alt);
    updateHeroControls();
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
        <button class="property-photo ${propertyImages(property)[0]?.type === "video" ? "has-cover-video" : ""}" type="button" data-property-id="${escapeHTML(property.id)}" aria-label="Ver ficha de ${escapeHTML(property.title)}" style="background-image:url('${escapeHTML(propertyImages(property).find((item) => item.type === "image")?.url || "") }')">
          ${propertyImages(property)[0]?.type === "video" ? `<video class="property-cover-video" src="${escapeHTML(propertyImages(property)[0].url)}" muted autoplay loop playsinline preload="metadata"></video><span class="video-label">Vídeo</span>` : ""}
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
    dialogVideo.pause();
    dialogVideo.removeAttribute("src");
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
    updateGalleryPlayback();
  });
  document.querySelector("#gallery-next").addEventListener("click", () => {
    galleryIndex = (galleryIndex + 1) % galleryImages.length;
    showGalleryImage();
    updateGalleryPlayback();
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

  const renderContactDetails = (settings = {}) => {
    const phone = settings.phone || config.phone || "";
    const email = settings.email || config.email || "";
    contactEmail = email;
    whatsappNumber = String(settings.whatsapp || config.whatsapp || "").replace(/\D/g, "");
    const details = [];
    if (phone) details.push(`<a href="tel:${escapeHTML(phone)}">${escapeHTML(phone)}</a>`);
    if (whatsappNumber) details.push(`<a href="https://wa.me/${escapeHTML(whatsappNumber)}" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp ↗</a>`);
    if (email) details.push(`<a href="mailto:${escapeHTML(email)}">${escapeHTML(email)}</a>`);
    document.querySelector("#contact-details").innerHTML = details.length ? details.join("") : `<span class="contact-setup">Llámanos o escríbenos para ayudarte.</span>`;
    document.querySelector("#form-help").textContent = contactHint();
  };

  const applySiteContent = (content = {}) => {
    if (content.aboutTitle) document.querySelector("#about-heading").textContent = content.aboutTitle;
    if (content.aboutText) document.querySelector("#about-description").textContent = content.aboutText;
    if (content.aboutStat) document.querySelector("#about-stat").textContent = content.aboutStat;
    if (content.aboutStatLabel) document.querySelector("#about-stat-label").textContent = content.aboutStatLabel;
    applyHeroPictures(content.heroImages);
    renderContactDetails(content);
    renderSocialLinks(content.socials);
    const reviews = Array.isArray(content.reviews) ? content.reviews.filter((review) => review.name && review.text) : [];
    const section = document.querySelector("#resenas");
    section.hidden = reviews.length === 0;
    document.querySelector("#reviews-grid").innerHTML = reviews.map((review) => `<article class="review-card"><div class="review-stars" aria-label="Reseña de cliente">★★★★★</div><blockquote>“${escapeHTML(review.text)}”</blockquote><p>${escapeHTML(review.name)}</p></article>`).join("");
    renderPageLinks(content.pages);
    applyCustomPageRoute(content.pages);
  };

  const renderSocialLinks = (socials = {}) => {
    const container = document.querySelector("#social-links");
    const labels = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn" };
    container.replaceChildren();
    Object.entries(labels).forEach(([network, label]) => {
      const value = socials?.[network];
      if (!/^https?:\/\//i.test(value || "")) return;
      const link = document.createElement("a");
      link.href = value;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = label;
      container.appendChild(link);
    });
    container.hidden = container.children.length === 0;
  };

  const renderPageLinks = (pages) => {
    const validPages = Array.isArray(pages) ? pages.filter((page) => page?.title && page?.slug) : [];
    document.querySelectorAll("[data-custom-page-link]").forEach((link) => link.remove());
    const navCta = document.querySelector(".nav-cta");
    const footerLinks = document.querySelector(".footer-links");
    validPages.forEach((page) => {
      const href = `${window.location.pathname}?pagina=${encodeURIComponent(page.slug)}`;
      const navLink = document.createElement("a");
      navLink.href = href;
      navLink.textContent = page.title;
      navLink.dataset.customPageLink = "true";
      navCta.before(navLink);
      const footerLink = document.createElement("a");
      footerLink.href = href;
      footerLink.textContent = page.title;
      footerLink.dataset.customPageLink = "true";
      footerLinks.appendChild(footerLink);
    });
  };

  const applyCustomPageRoute = (pages) => {
    const requestedSlug = new URLSearchParams(window.location.search).get("pagina");
    if (!requestedSlug) return;
    const page = Array.isArray(pages) ? pages.find((item) => item?.slug === requestedSlug) : null;
    if (!page) return;
    const main = document.querySelector("main");
    const section = document.querySelector("#custom-page");
    [...main.children].forEach((child) => { if (child !== section) child.hidden = true; });
    const paragraphs = String(page.body || "").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
      .map((part) => `<p>${escapeHTML(part).replace(/\n/g, "<br>")}</p>`).join("");
    const image = /^https?:\/\//i.test(page.image || "") ? `<img class="custom-page-image" src="${escapeHTML(page.image)}" alt="${escapeHTML(page.title)}" />` : "";
    section.innerHTML = `<a class="custom-page-back" href="${escapeHTML(window.location.pathname)}">← Volver al inicio</a>${image}<div class="custom-page-copy"><p class="eyebrow"><span></span> Inmobiliaria La Alcayna</p><h1>${escapeHTML(page.title)}</h1>${paragraphs}</div>`;
    section.hidden = false;
    document.title = `${page.title} | ${config.name || "Inmobiliaria"}`;
  };

  renderContactDetails();

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
    if (contactEmail) {
      const subject = selectedProperty ? `Consulta sobre ${selectedProperty.title}` : "Consulta desde la web inmobiliaria";
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
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
  nav.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    menuButton.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
  });

  document.querySelector("#form-help").textContent = contactHint();

  const assistantToggle = document.querySelector("#assistant-toggle");
  const assistantPanel = document.querySelector("#assistant-panel");
  const assistantClose = document.querySelector("#assistant-close");
  const assistantMessages = document.querySelector("#assistant-messages");
  const assistantSuggestions = document.querySelector("#assistant-suggestions");
  const assistantForm = document.querySelector("#assistant-form");
  const assistantInput = document.querySelector("#assistant-input");
  let assistantStarted = false;
  let assistantSearching = false;
  let assistantOperation = "all";
  let assistantLeadSummary = "";

  const normalizeAssistantText = (value) => String(value ?? "").toLocaleLowerCase("es")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¡!¿?.,;:]/g, " ").replace(/\s+/g, " ").trim();

  const appendAssistantMessage = (text, role = "bot") => {
    const message = document.createElement("div");
    message.className = `assistant-message assistant-message-${role}`;
    message.textContent = text;
    assistantMessages.appendChild(message);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
    return message;
  };

  const setAssistantSuggestions = (items = []) => {
    assistantSuggestions.replaceChildren();
    items.forEach(({ label, action }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        appendAssistantMessage(label, "user");
        setAssistantSuggestions();
        action();
      });
      assistantSuggestions.appendChild(button);
    });
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
  };

  const openAssistant = (isOpen) => {
    assistantPanel.hidden = !isOpen;
    assistantToggle.setAttribute("aria-expanded", String(isOpen));
    assistantToggle.setAttribute("aria-label", isOpen ? "Cerrar asistente virtual" : "Abrir asistente virtual");
    if (isOpen) {
      if (!assistantStarted) {
        assistantStarted = true;
        appendAssistantMessage("¡Hola! Soy el asistente virtual de Inmobiliaria La Alcayna. Puedo ayudarte a buscar vivienda y orientarte con consultas frecuentes.");
        setAssistantSuggestions([
          { label: "Buscar vivienda", action: () => startAssistantSearch() },
          { label: "Quiero vender", action: () => startAssistantSale() },
          { label: "Hablar con el equipo", action: () => contactAssistantTeam() }
        ]);
      }
      assistantInput.focus();
    } else assistantToggle.focus();
  };

  const assistantSearchPrompt = () => {
    appendAssistantMessage("¿Buscas comprar o alquilar? Después puedes decirme la zona, el presupuesto y cuántas habitaciones necesitas.");
    setAssistantSuggestions([
      { label: "Comprar", action: () => chooseAssistantOperation("venta") },
      { label: "Alquilar", action: () => chooseAssistantOperation("alquiler") },
      { label: "Ver todas", action: () => runAssistantSearch("ver todas") }
    ]);
  };

  function startAssistantSearch() {
    assistantSearching = true;
    assistantOperation = "all";
    assistantLeadSummary = "Estoy buscando una vivienda";
    assistantSearchPrompt();
  }

  function chooseAssistantOperation(operation) {
    assistantSearching = true;
    assistantOperation = operation;
    assistantLeadSummary = operation === "alquiler" ? "Busco una vivienda de alquiler" : "Busco una vivienda para comprar";
    appendAssistantMessage(`Perfecto. ¿Qué zona, presupuesto aproximado o características buscas? Puedes escribirlo en una frase o ver las opciones publicadas${operation === "alquiler" ? " en alquiler" : " en venta"}.`);
    setAssistantSuggestions([
      { label: "Ver todas", action: () => runAssistantSearch("ver todas") },
      { label: "Hablar con el equipo", action: () => contactAssistantTeam() }
    ]);
  }

  const parseAssistantPrice = (text) => {
    const match = text.match(/(?:hasta|maximo|presupuesto(?: de)?|menos de|tope(?: de)?)\s*(?:de\s*)?(?:€\s*)?(\d[\d., ]*\s*k?)(?!\s*(?:hab|dorm|habitacion|cuarto))/i);
    if (!match) return null;
    const value = match[1].replace(/\s/g, "");
    if (/k$/i.test(value)) return Math.round((Number.parseFloat(value.slice(0, -1).replace(",", ".")) || 0) * 1000) || null;
    return Number(value.replace(/[.,]/g, "")) || null;
  };

  const assistantSearchCriteria = (rawText, operationHint = "all") => {
    const text = normalizeAssistantText(rawText);
    const operation = /\b(alquilar|alquiler|alquilo|rent|rentar)\b/.test(text) ? "alquiler"
      : /\b(comprar|compra|compro|venta|vender)\b/.test(text) ? "venta"
        : operationHint !== "all" ? operationHint : "all";
    const type = /\b(atico|penthouse)\b/.test(text) ? "atico"
      : /\b(casa|chalet|adosado|unifamiliar)\b/.test(text) ? "casa"
        : /\b(piso|apartamento|apartamentos)\b/.test(text) ? "piso"
          : /\b(local|locales|comercial)\b/.test(text) ? "local"
            : /\b(terreno|solar|parcela)\b/.test(text) ? "terreno" : "";
    const price = parseAssistantPrice(text);
    const roomsMatch = text.match(/\b(\d+)\s*(?:habitaciones?|dormitorios?|hab\.?|dorm\.?|cuartos?)\b/);
    const bedrooms = roomsMatch ? Number(roomsMatch[1]) : null;
    let location = text
      .replace(/(?:hasta|maximo|presupuesto(?: de)?|menos de|tope(?: de)?)\s*(?:de\s*)?(?:€\s*)?\d[\d., ]*\s*k?/g, " ")
      .replace(/\b\d+\s*(?:habitaciones?|dormitorios?|hab\.?|dorm\.?|cuartos?)\b/g, " ")
      .replace(/\b(busco|buscar|buscando|quiero|necesito|necesitamos|estoy|una|un|la|el|los|las|de|para|por|en|cerca|zona|con|que|me|interesa|interesan|vivienda|viviendas|inmueble|inmuebles|propiedad|propiedades|casa|chalet|adosado|unifamiliar|piso|apartamento|apartamentos|atico|local|locales|comercial|terreno|solar|parcela|comprar|compra|compro|venta|vender|alquilar|alquiler|alquilo|ver|todas|todos|opciones|publicadas|publicados|euros|euro|habitacion|habitaciones|dormitorio|dormitorios|hab|dorm)\b/g, " ")
      .replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim();
    return { operation, type, price, bedrooms, location };
  };

  const summarizeAssistantCriteria = (criteria) => {
    const parts = [];
    if (criteria.operation === "venta") parts.push("para comprar");
    if (criteria.operation === "alquiler") parts.push("de alquiler");
    if (criteria.type) parts.push(typeNames[criteria.type]?.toLowerCase() || "vivienda");
    if (criteria.location) parts.push(`en ${criteria.location}`);
    if (criteria.price) parts.push(`hasta ${new Intl.NumberFormat("es-ES").format(criteria.price)} €${criteria.operation === "alquiler" ? "/mes" : ""}`);
    if (criteria.bedrooms) parts.push(`con ${criteria.bedrooms} habitaciones`);
    return parts.length ? `Busco ${parts.join(" ")}` : "Estoy buscando una vivienda";
  };

  const showAssistantProperty = (property) => {
    const card = document.createElement("article");
    card.className = "assistant-result";
    const title = document.createElement("strong");
    title.textContent = property.title || "Propiedad";
    const details = document.createElement("span");
    details.textContent = `${property.location || "Ubicación por consultar"} · ${formatPrice(property.price, property.operation)}${Number(property.bedrooms) > 0 ? ` · ${property.bedrooms} hab.` : ""}`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Ver ficha";
    button.addEventListener("click", () => {
      assistantLeadSummary = `Me interesa la propiedad “${property.title}” en ${property.location}`;
      openAssistant(false);
      openProperty(property);
    });
    card.append(title, details, button);
    assistantMessages.appendChild(card);
    assistantMessages.scrollTop = assistantMessages.scrollHeight;
  };

  function runAssistantSearch(rawText, operationHint = assistantOperation) {
    const criteria = assistantSearchCriteria(rawText, operationHint);
    if (criteria.operation !== "all") assistantOperation = criteria.operation;
    assistantSearching = false;
    assistantLeadSummary = summarizeAssistantCriteria(criteria);
    if (!propertyDataLoaded || propertyLoadError) {
      appendAssistantMessage(propertyLoadError
        ? "No he podido cargar los anuncios ahora mismo. Puedes probar otra vez o contactar con el equipo."
        : "Estoy cargando los anuncios publicados. Prueba tu búsqueda de nuevo en unos segundos.");
      setAssistantSuggestions(propertyLoadError
        ? [{ label: "Hablar con el equipo", action: () => contactAssistantTeam() }]
        : [{ label: "Buscar ahora", action: () => runAssistantSearch(rawText, criteria.operation) }]);
      return;
    }
    const matches = properties.filter((property) => {
      if (criteria.operation !== "all" && property.operation !== criteria.operation) return false;
      if (criteria.type && property.type !== criteria.type) return false;
      if (criteria.price && Number(property.price) > criteria.price) return false;
      if (criteria.bedrooms && Number(property.bedrooms) < criteria.bedrooms) return false;
      if (criteria.location) {
        const searchable = normalizeAssistantText(`${property.title} ${property.location} ${property.description || ""}`);
        if (!searchable.includes(criteria.location)) return false;
      }
      return true;
    });

    if (matches.length) {
      appendAssistantMessage(`He encontrado ${matches.length === 1 ? "esta opción" : `${matches.length} opciones`} que coincide${matches.length === 1 ? "" : "n"} con tu búsqueda${matches.length > 3 ? "; te muestro las tres primeras" : ""}. El equipo puede confirmar disponibilidad y organizar una visita.`);
      matches.slice(0, 3).forEach(showAssistantProperty);
      setAssistantSuggestions([{ label: "Consultar al equipo", action: () => contactAssistantTeam() }, { label: "Nueva búsqueda", action: () => startAssistantSearch() }]);
    } else {
      appendAssistantMessage(properties.length
        ? "No encuentro anuncios publicados que coincidan con esos criterios. Puedes ampliar la búsqueda o pedir al equipo que te ayude a encontrar otras opciones."
        : "Ahora mismo no hay anuncios publicados para mostrar. Si nos cuentas qué buscas, el equipo podrá orientarte.");
      setAssistantSuggestions([
        { label: "Ampliar búsqueda", action: () => startAssistantSearch() },
        { label: "Hablar con el equipo", action: () => contactAssistantTeam() }
      ]);
    }
  }

  function contactAssistantTeam() {
    const message = `Hola, vengo del asistente de la web. ${assistantLeadSummary || "Quisiera recibir información inmobiliaria."}`;
    if (whatsappNumber) {
      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      appendAssistantMessage("Se ha preparado un mensaje en WhatsApp. Envíalo para que el equipo reciba tu consulta.");
    } else if (contactEmail) {
      window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent("Consulta desde el asistente web")}&body=${encodeURIComponent(message)}`;
      appendAssistantMessage("Se ha preparado un correo con tu consulta.");
    } else {
      appendAssistantMessage("Puedes dejar tu consulta en el formulario de contacto de la web.");
      setAssistantSuggestions([{ label: "Ir a contacto", action: () => {
        openAssistant(false);
        document.querySelector("#contacto").scrollIntoView({ behavior: "smooth" });
        document.querySelector('#contact-form input[name="nombre"]').focus({ preventScroll: true });
      } }]);
    }
  }

  function startAssistantSale() {
    assistantSearching = false;
    assistantLeadSummary = "Quiero información para vender o alquilar una propiedad";
    appendAssistantMessage("Claro. Para orientarte, el equipo necesitará conocer la zona y el tipo de propiedad. Si quieres, puedes enviarles ahora la consulta y concretar esos detalles con ellos.");
    setAssistantSuggestions([{ label: "Consultar al equipo", action: () => contactAssistantTeam() }, { label: "Buscar vivienda", action: () => startAssistantSearch() }]);
  }

  const assistantHandleInput = (rawText) => {
    const text = normalizeAssistantText(rawText);
    if (!text) return;
    appendAssistantMessage(rawText.trim(), "user");
    setAssistantSuggestions();

    if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches|hey)\b/.test(text) && text.split(" ").length < 6) {
      appendAssistantMessage("¡Hola! ¿Qué necesitas hoy?");
      setAssistantSuggestions([
        { label: "Buscar vivienda", action: () => startAssistantSearch() },
        { label: "Quiero vender", action: () => startAssistantSale() },
        { label: "Hablar con el equipo", action: () => contactAssistantTeam() }
      ]);
      return;
    }

    if (/\b(comision|comisiones|honorarios|impuestos|gastos|arras|hipoteca|financiacion|financiar|documentacion|documentos|contrato|legal|notaria)\b/.test(text)) {
      assistantSearching = false;
      appendAssistantMessage("Prefiero no darte una cifra o condición que pueda variar. El equipo puede confirmarte los detalles de esa operación.");
      setAssistantSuggestions([{ label: "Consultar al equipo", action: () => contactAssistantTeam() }]);
      return;
    }

    if (/\b(visita|visitar|disponible|disponibilidad|reservar|reservada|vendida)\b/.test(text)) {
      assistantSearching = false;
      appendAssistantMessage("La ficha muestra la información publicada. El equipo debe confirmar si sigue disponible y acordar las visitas.");
      setAssistantSuggestions([{ label: "Consultar al equipo", action: () => contactAssistantTeam() }, { label: "Ver propiedades", action: () => {
        openAssistant(false);
        document.querySelector("#propiedades").scrollIntoView({ behavior: "smooth" });
      } }]);
      return;
    }

    if (/\b(horario|horarios|oficina|direccion|donde estan|donde estais)\b/.test(text)) {
      assistantSearching = false;
      assistantLeadSummary = rawText.trim();
      appendAssistantMessage("No tengo horarios ni dirección de oficina confirmados. El equipo puede darte esa información.");
      setAssistantSuggestions([{ label: "Consultar al equipo", action: () => contactAssistantTeam() }]);
      return;
    }

    if (/\b(vender|venderla|venderlo|venta de mi|alquilar mi|alquiler de mi|publicar mi|poner en venta|valorar mi)\b/.test(text)) {
      startAssistantSale();
      return;
    }

    if (/\b(persona|agente|asesor|humano|equipo|contacto|whatsapp|llamar|telefono|hablar con alguien)\b/.test(text)) {
      assistantSearching = false;
      assistantLeadSummary = rawText.trim();
      contactAssistantTeam();
      return;
    }

    const searchRequest = /\b(busco|buscar|buscando|comprar|compro|compra|alquilar|alquilo|alquiler|piso|casa|chalet|atico|apartamento|local|terreno|vivienda|propiedad)\b/.test(text);
    const genericSearch = /^(?:quiero |necesito )?(?:buscar|buscando|comprar|compro|alquilar|alquilo)? ?(?:una? )?(?:vivienda|propiedad|casa|piso)?$/.test(text);
    if (assistantSearching || searchRequest) {
      const criteria = assistantSearchCriteria(rawText, assistantOperation);
      if (genericSearch || (assistantSearching && /^(comprar|alquilar|venta|alquiler)$/.test(text))) {
        if (criteria.operation !== "all") chooseAssistantOperation(criteria.operation);
        else assistantSearchPrompt();
        return;
      }
      runAssistantSearch(rawText, assistantOperation);
      return;
    }

    appendAssistantMessage("Puedo ayudarte a buscar una propiedad, consultar disponibilidad o pasar tu consulta al equipo. ¿Qué te gustaría hacer?");
    setAssistantSuggestions([
      { label: "Buscar vivienda", action: () => startAssistantSearch() },
      { label: "Quiero vender", action: () => startAssistantSale() },
      { label: "Hablar con el equipo", action: () => contactAssistantTeam() }
    ]);
  };

  assistantToggle.addEventListener("click", () => openAssistant(assistantPanel.hidden));
  assistantClose.addEventListener("click", () => openAssistant(false));
  assistantForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = assistantInput.value;
    assistantInput.value = "";
    assistantHandleInput(value);
  });
  assistantInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") openAssistant(false);
  });

  renderProperties();
  if (cloudClient) {
    cloudClient.from("site_settings").select("content").eq("id", "main").maybeSingle().then(({ data }) => {
      if (data?.content) applySiteContent(data.content);
    });
    cloudClient.from("properties").select("*").eq("is_published", true).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) {
        propertyDataLoaded = true;
        propertyLoadError = true;
        resultsCount.textContent = "No se pudieron cargar las propiedades. Vuelve a intentarlo más tarde.";
        return;
      }
      properties = (data || []).map(fromDatabase);
      propertyDataLoaded = true;
      renderProperties();
      openSharedProperty();
    }).catch(() => {
      propertyDataLoaded = true;
      propertyLoadError = true;
      resultsCount.textContent = "No se pudieron cargar las propiedades. Vuelve a intentarlo más tarde.";
    });
  } else openSharedProperty();
})();

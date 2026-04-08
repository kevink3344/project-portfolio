import { useState, useEffect } from 'react';

export default function ProjectCard({ project }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsMounted, setDetailsMounted] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const tags = project.tech_tags
    ? project.tech_tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // Close overlays on Escape key
  useEffect(() => {
    if (!lightboxOpen && !detailsMounted) return;

    function onKey(e) {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setDetailsOpen(false);
        return;
      }

      if (!lightboxOpen || galleryImages.length < 2) return;

      if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
      }

      if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, detailsMounted, galleryImages.length]);

  useEffect(() => {
    if (detailsOpen) {
      setDetailsMounted(true);
      const raf = window.requestAnimationFrame(() => setDetailsOpen(true));
      return () => window.cancelAnimationFrame(raf);
    }

    if (!detailsMounted) return undefined;
    const timeoutId = window.setTimeout(() => setDetailsMounted(false), 300);
    return () => window.clearTimeout(timeoutId);
  }, [detailsOpen, detailsMounted]);

  useEffect(() => {
    if (lightboxOpen || detailsMounted) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen, detailsMounted]);

  const imageVersion = project.updated_at || project.created_at || '';
  const imageUrl = `/api/projects/${project.id}/image?v=${encodeURIComponent(imageVersion)}`;
  const activeLightboxImage = galleryImages[currentImageIndex]?.url || imageUrl;

  useEffect(() => {
    setGalleryImages([]);
    setCurrentImageIndex(0);
  }, [project.id]);

  async function openLightbox() {
    setLightboxOpen(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/images`);
      if (!response.ok) {
        setGalleryImages([{ id: 'fallback', url: imageUrl }]);
        setCurrentImageIndex(0);
        return;
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setGalleryImages(data.map((img) => ({ id: img.id, url: img.url })));
      } else {
        setGalleryImages([{ id: 'fallback', url: imageUrl }]);
      }
      setCurrentImageIndex(0);
    } catch {
      setGalleryImages([{ id: 'fallback', url: imageUrl }]);
      setCurrentImageIndex(0);
    }
  }

  function showNextImage(e) {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  }

  function showPreviousImage(e) {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  }

  return (
    <>
      <div className="h-[30rem] flex flex-col rounded-[3px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        {project.has_image ? (
          <button
            onClick={openLightbox}
            className="w-full h-52 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-zoom-in"
            aria-label={`View full image for ${project.title}`}
          >
            <img
              src={imageUrl}
              alt={`${project.title} thumbnail`}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
          </button>
        ) : (
          <div className="w-full h-52 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            Coming Soon
          </div>
        )}

        <div className="flex-1 flex flex-col gap-3 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white leading-snug">
              {project.title}
            </h2>
            {project.project_category && (
              <span className="px-2 py-0.5 rounded-[3px] text-xs font-semibold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                {project.project_category}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
            {project.description}
          </p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-auto pt-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-[3px] text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="pt-1 mt-auto min-h-8 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setDetailsMounted(true);
                  window.requestAnimationFrame(() => setDetailsOpen(true));
                }}
                className="inline-flex items-center gap-2 rounded-[3px] border border-blue-300 dark:border-blue-700 px-2.5 py-1 text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                aria-label={`View details for ${project.title}`}
              >
                View details
              </button>
              {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-[3px] border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-sm font-medium text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label={`Open GitHub repository for ${project.title}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M12 .5a12 12 0 00-3.79 23.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.41-4.04-1.41a3.18 3.18 0 00-1.34-1.75c-1.1-.75.08-.74.08-.74a2.52 2.52 0 011.84 1.24 2.56 2.56 0 003.49 1 2.55 2.55 0 01.76-1.6c-2.67-.3-5.47-1.33-5.47-5.94a4.65 4.65 0 011.24-3.22 4.3 4.3 0 01.12-3.17s1.01-.33 3.3 1.23a11.35 11.35 0 016 0c2.29-1.56 3.3-1.23 3.3-1.23a4.3 4.3 0 01.12 3.17 4.64 4.64 0 011.24 3.22c0 4.62-2.8 5.64-5.48 5.93a2.85 2.85 0 01.81 2.2v3.25c0 .32.22.69.83.57A12 12 0 0012 .5z" />
                </svg>
                View repository
              </a>
              )}
              {project.site_url && (
              <a
                href={project.site_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-[3px] border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-sm font-medium text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label={`Open live site for ${project.title}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 000 5.656m-3.656-9.9a4 4 0 000 5.657m-1.414-1.415L7.343 11.586a4 4 0 005.657 5.657l1.414-1.414m-5.656-9.9l1.414-1.414a4 4 0 015.657 5.657l-1.415 1.414" />
                </svg>
                View site
              </a>
              )}
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Close image"
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={activeLightboxImage}
            alt={project.title}
            className="max-w-full max-h-[90vh] rounded-[3px] shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {galleryImages.length > 1 && (
            <>
              <button
                onClick={showPreviousImage}
                aria-label="Previous image"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white hover:bg-black/60 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={showNextImage}
                aria-label="Next image"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white hover:bg-black/60 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {detailsMounted && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
              detailsOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setDetailsOpen(false)}
            aria-label="Close details panel"
          />

          <aside
            className={`absolute inset-y-0 right-0 w-full max-w-2xl transform-gpu border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300 ${
              detailsOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            aria-label={`${project.title} details`}
          >
            <div className="h-full overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-5 py-4 backdrop-blur-sm">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{project.title}</h3>
                  {project.app_type && (
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{project.app_type}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="rounded-[3px] p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close details panel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 space-y-5">
                {project.has_image ? (
                  <img
                    src={imageUrl}
                    alt={`${project.title} thumbnail`}
                    className="w-full max-h-[22rem] rounded-[3px] border border-gray-200 dark:border-gray-700 object-cover"
                  />
                ) : (
                  <div className="w-full h-56 rounded-[3px] border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                    Coming Soon
                  </div>
                )}

                {project.project_category && (
                  <span className="inline-flex px-2.5 py-1 rounded-[3px] text-xs font-semibold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                    {project.project_category}
                  </span>
                )}

                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {project.description}
                  </p>
                </div>

                {tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Tech Stack</h4>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-[3px] text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-[3px] border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      View repository
                    </a>
                  )}
                  {project.site_url && (
                    <a
                      href={project.site_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-[3px] border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-black dark:text-gray-300 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      View site
                    </a>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}


import { useState, useEffect } from 'react';

export default function ProjectCard({ project }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const tags = project.tech_tags
    ? project.tech_tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // Close on Escape key
  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setLightboxOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen]);

  const imageVersion = project.updated_at || project.created_at || '';
  const imageUrl = `/api/projects/${project.id}/image?v=${encodeURIComponent(imageVersion)}`;

  return (
    <>
      <div className="h-[30rem] flex flex-col rounded-[3px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        {project.has_image ? (
          <button
            onClick={() => setLightboxOpen(true)}
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
            src={imageUrl}
            alt={project.title}
            className="max-w-full max-h-[90vh] rounded-[3px] shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}


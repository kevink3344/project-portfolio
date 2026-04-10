import { useEffect, useState } from 'react';

const APP_TYPE_OPTIONS = ['Pro-Code Apps', 'Model-Driven Apps', 'Canvas Apps', 'Prototype Apps'];

const EMPTY_FORM = {
  title: '',
  description: '',
  app_type: 'Pro-Code Apps',
  tech_tags: '',
  is_active: true,
  project_category: '',
  github_url: '',
  site_url: '',
  imageFiles: [],
};

export default function ProjectForm({ project, onSave, onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [form, setForm] = useState(
    project
      ? {
          title: project.title,
          description: project.description,
          app_type: project.app_type || 'Pro-Code Apps',
          tech_tags: project.tech_tags,
          is_active: project.is_active !== 0,
          project_category: project.project_category || '',
          github_url: project.github_url || '',
          site_url: project.site_url || '',
          imageFiles: [],
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [existingImagesLoading, setExistingImagesLoading] = useState(false);
  const [removedImageIds, setRemovedImageIds] = useState([]);

  const imageOrderStorageKey = project ? `project-image-order-${project.id}` : null;

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setIsOpen(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const urls = form.imageFiles.map((file) => URL.createObjectURL(file));
    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [form.imageFiles]);

  useEffect(() => {
    if (!project?.id) return;

    let cancelled = false;

    async function loadImages() {
      setExistingImagesLoading(true);
      try {
        const res = await fetch(`/api/projects/${project.id}/images`);
        if (!res.ok) throw new Error('Failed to load project images');
        const data = await res.json();
        if (!Array.isArray(data)) return;

        let nextImages = data.map((img) => ({
          id: img.id,
          url: img.url,
          mime: img.mime || null,
        }));

        if (imageOrderStorageKey) {
          const raw = localStorage.getItem(imageOrderStorageKey);
          if (raw) {
            try {
              const savedOrder = JSON.parse(raw);
              if (Array.isArray(savedOrder)) {
                const imageMap = new Map(nextImages.map((img) => [String(img.id), img]));
                const ordered = [];
                for (const imageId of savedOrder) {
                  const key = String(imageId);
                  if (imageMap.has(key)) {
                    ordered.push(imageMap.get(key));
                    imageMap.delete(key);
                  }
                }
                nextImages = [...ordered, ...imageMap.values()];
              }
            } catch {
              // Ignore malformed localStorage payloads.
            }
          }
        }

        if (!cancelled) {
          setExistingImages(nextImages);
        }
      } catch {
        if (!cancelled) {
          setExistingImages([]);
        }
      } finally {
        if (!cancelled) {
          setExistingImagesLoading(false);
        }
      }
    }

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [project?.id, imageOrderStorageKey]);

  useEffect(() => {
    if (!imageOrderStorageKey) return;
    localStorage.setItem(imageOrderStorageKey, JSON.stringify(existingImages.map((image) => image.id)));
  }, [existingImages, imageOrderStorageKey]);

  function handleChange(e) {
    if (e.target.type === 'checkbox') {
      setForm((f) => ({ ...f, [e.target.name]: e.target.checked }));
      return;
    }

    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setForm((f) => ({ ...f, imageFiles: [...f.imageFiles, ...files] }));
  }

  function removeSelectedImage(index) {
    setForm((f) => ({
      ...f,
      imageFiles: f.imageFiles.filter((_, i) => i !== index),
    }));
  }

  function removeExistingImage(imageId) {
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    setRemovedImageIds((prev) => {
      if (prev.includes(imageId)) return prev;
      return [...prev, imageId];
    });
  }

  function moveExistingImage(imageId, direction) {
    setExistingImages((prev) => {
      const currentIndex = prev.findIndex((img) => img.id === imageId);
      if (currentIndex === -1) return prev;

      const nextIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;

      const reordered = [...prev];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(nextIndex, 0, moved);
      return reordered;
    });
  }

  function movePendingImage(index, direction) {
    setForm((current) => {
      const nextIndex = direction === 'left' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.imageFiles.length) return current;

      const reordered = [...current.imageFiles];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, moved);
      return { ...current, imageFiles: reordered };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const token = localStorage.getItem('adminToken');
    const method = project ? 'PUT' : 'POST';
    const url = project ? `/api/projects/${project.id}` : '/api/projects';

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    formData.append('app_type', form.app_type);
    formData.append('tech_tags', form.tech_tags);
    formData.append('is_active', String(form.is_active));
    formData.append('project_category', form.project_category);
    formData.append('github_url', form.github_url);
    formData.append('site_url', form.site_url);
    if (form.imageFiles.length > 0) {
      for (const file of form.imageFiles) {
        formData.append('images', file);
      }
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      if (project) {
        for (const imageId of removedImageIds) {
          const deleteRes = await fetch(`/api/projects/${project.id}/images/${imageId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!deleteRes.ok) {
            const deleteData = await deleteRes.json().catch(() => ({}));
            throw new Error(deleteData.error || 'Failed to remove image');
          }
        }

        const reorderableIds = existingImages
          .filter((image) => image.id !== 'legacy')
          .map((image) => Number(image.id))
          .filter((value) => !Number.isNaN(value));

        if (reorderableIds.length > 0) {
          const orderRes = await fetch(`/api/projects/${project.id}/images/order`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageIds: reorderableIds }),
          });

          if (!orderRes.ok) {
            const orderData = await orderRes.json().catch(() => ({}));
            throw new Error(orderData.error || 'Failed to save image order');
          }
        }
      }

      if (imageOrderStorageKey) {
        localStorage.setItem(imageOrderStorageKey, JSON.stringify(existingImages.map((image) => image.id)));
      }

      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <aside
        className={`absolute inset-y-0 right-0 w-full max-w-2xl border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl transform-gpu transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {project ? 'Edit Project' : 'Add Project'}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="px-6 pt-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('images')}
                className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
                  activeTab === 'images'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Images
              </button>
            </div>
          </div>

          {error && (
            <p className="mx-6 mt-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {activeTab === 'details' ? (
                <div className="flex flex-col gap-4">
                  <Field label="Title" name="title" value={form.title} onChange={handleChange} required />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">App Type</label>
                    <select
                      name="app_type"
                      value={form.app_type}
                      onChange={handleChange}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {APP_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label="Project Category"
                    name="project_category"
                    value={form.project_category}
                    onChange={handleChange}
                    placeholder="e.g. Current, Future Idea, Archive"
                  />
                  <Field
                    label="GitHub Repository URL"
                    name="github_url"
                    value={form.github_url}
                    onChange={handleChange}
                    placeholder="https://github.com/username/repo"
                  />
                  <Field
                    label="Live Site URL"
                    name="site_url"
                    value={form.site_url}
                    onChange={handleChange}
                    placeholder="https://your-site.com"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <textarea
                      name="description"
                      required
                      rows={6}
                      value={form.description}
                      onChange={handleChange}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                    />
                  </div>
                  <Field
                    label="Tech tags (comma-separated)"
                    name="tech_tags"
                    value={form.tech_tags}
                    onChange={handleChange}
                    placeholder="React, Node.js, SQLite"
                  />
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {form.is_active ? 'Active (visible to viewers)' : 'Inactive (hidden from viewers)'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={form.is_active}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 rounded-full bg-gray-300 dark:bg-gray-600 peer-checked:bg-emerald-600 transition-colors peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/60" />
                      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload images</label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100"
                    />
                    {project?.has_image && form.imageFiles.length === 0 && existingImages.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">Existing images are shown below. New uploads are appended.</p>
                    )}
                  </div>

                  {project && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Existing images ({existingImages.length})</p>
                      {existingImagesLoading ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500">Loading existing images...</p>
                      ) : existingImages.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500">No existing images.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {existingImages.map((image, index) => (
                            <div key={String(image.id)} className="relative rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                              <img
                                src={image.url}
                                alt={`Existing ${index + 1}`}
                                className="w-full h-28 object-cover rounded-md"
                              />
                              <div className="absolute top-1 left-1 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveExistingImage(image.id, 'left')}
                                  className="rounded bg-black/60 text-white px-1.5 py-0.5 text-xs hover:bg-black/80"
                                  aria-label={`Move image ${index + 1} left`}
                                  disabled={index === 0}
                                >
                                  {'<'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveExistingImage(image.id, 'right')}
                                  className="rounded bg-black/60 text-white px-1.5 py-0.5 text-xs hover:bg-black/80"
                                  aria-label={`Move image ${index + 1} right`}
                                  disabled={index === existingImages.length - 1}
                                >
                                  {'>'}
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeExistingImage(image.id)}
                                className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 hover:bg-black/80"
                                aria-label={`Remove existing image ${index + 1}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {previews.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Selected images ({previews.length})</p>
                      <div className="grid grid-cols-2 gap-3">
                        {previews.map((previewUrl, index) => (
                          <div key={previewUrl} className="relative">
                            <img
                              src={previewUrl}
                              alt={`Selected ${index + 1}`}
                              className="w-full h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                            />
                            <div className="absolute top-1 left-1 flex gap-1">
                              <button
                                type="button"
                                onClick={() => movePendingImage(index, 'left')}
                                className="rounded bg-black/60 text-white px-1.5 py-0.5 text-xs hover:bg-black/80"
                                aria-label={`Move selected image ${index + 1} left`}
                                disabled={index === 0}
                              >
                                {'<'}
                              </button>
                              <button
                                type="button"
                                onClick={() => movePendingImage(index, 'right')}
                                className="rounded bg-black/60 text-white px-1.5 py-0.5 text-xs hover:bg-black/80"
                                aria-label={`Move selected image ${index + 1} right`}
                                disabled={index === previews.length - 1}
                              >
                                {'>'}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSelectedImage(index)}
                              className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 hover:bg-black/80"
                              aria-label={`Remove image ${index + 1}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, name, value, onChange, required, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

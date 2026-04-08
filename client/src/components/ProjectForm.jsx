import { useEffect, useState } from 'react';

const APP_TYPE_OPTIONS = ['Pro-Code Apps', 'Model-Driven Apps', 'Canvas Apps', 'Prototype Apps'];

const EMPTY_FORM = {
  title: '',
  description: '',
  app_type: 'Pro-Code Apps',
  tech_tags: '',
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

  function handleChange(e) {
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
                    {project?.has_image && form.imageFiles.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">Leave blank to keep existing images. New uploads are appended.</p>
                    )}
                  </div>

                  {project?.has_image && previews.length === 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Current cover image</p>
                      <img
                        src={`/api/projects/${project.id}/image`}
                        alt="Current cover"
                        className="w-full h-44 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                      />
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

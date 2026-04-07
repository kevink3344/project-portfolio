import { useState } from 'react';

const EMPTY_FORM = { title: '', description: '', tech_tags: '', project_category: '', github_url: '', site_url: '', thumbnailFile: null };

export default function ProjectForm({ project, onSave, onClose }) {
  const [form, setForm] = useState(
    project
      ? {
          title: project.title,
          description: project.description,
          tech_tags: project.tech_tags,
          project_category: project.project_category || '',
          github_url: project.github_url || '',
          site_url: project.site_url || '',
          thumbnailFile: null,
        }
      : EMPTY_FORM
  );
  const [preview, setPreview] = useState(project?.has_image ? `/api/projects/${project.id}/image` : null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setForm((f) => ({ ...f, thumbnailFile: file }));
    setPreview(URL.createObjectURL(file));
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
    formData.append('tech_tags', form.tech_tags);
    formData.append('project_category', form.project_category);
    formData.append('github_url', form.github_url);
    formData.append('site_url', form.site_url);
    if (form.thumbnailFile) {
      formData.append('thumbnail', form.thumbnailFile);
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
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
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

        {error && (
          <p className="mb-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Title" name="title" value={form.title} onChange={handleChange} required />
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
              rows={4}
              value={form.description}
              onChange={handleChange}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          <Field
            label="Tech tags (comma-separated)"
            name="tech_tags"
            value={form.tech_tags}
            onChange={handleChange}
            placeholder="React, Node.js, Azure SQL"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Thumbnail image</label>
            {preview && (
              <img src={preview} alt="Preview" className="w-full h-36 object-cover rounded-lg mb-1" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100"
            />
            {project?.has_image && !form.thumbnailFile && (
              <p className="text-xs text-gray-400 dark:text-gray-500">Leave blank to keep the existing image</p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-2">
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

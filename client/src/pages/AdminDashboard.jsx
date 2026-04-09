import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';

export default function AdminDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      setProjects(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  }

  function openAdd() {
    setEditingProject(null);
    setShowForm(true);
  }

  function openEdit(project) {
    setEditingProject(project);
    setShowForm(true);
  }

  function handleSaved(saved) {
    setProjects((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
    });
    setShowForm(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this project?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
        <div className="flex gap-3">
          <button
            onClick={openAdd}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            + Add Project
          </button>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-gray-400 dark:text-gray-500 animate-pulse">Loading…</p>
      )}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && projects.length === 0 && (
        <p className="text-gray-400 dark:text-gray-500 py-12 text-center">No projects yet. Add one!</p>
      )}

      {projects.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">App Type</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Tags</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{project.title}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 dark:text-gray-400">
                      {project.app_type || '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-500 dark:text-gray-400">
                    {project.tech_tags || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(project)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="text-red-500 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ProjectForm
          project={editingProject}
          onSave={handleSaved}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

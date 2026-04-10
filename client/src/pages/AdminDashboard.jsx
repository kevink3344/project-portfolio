import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectForm from '../components/ProjectForm';
import IntegrationForm from '../components/IntegrationForm';

export default function AdminDashboard() {
  const [projects, setProjects] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('projects');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showIntegrationForm, setShowIntegrationForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const navigate = useNavigate();

  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    fetchProjects();
    fetchIntegrations();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects/admin/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load projects');
      setProjects(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchIntegrations() {
    try {
      const res = await fetch('/api/integrations');
      if (!res.ok) throw new Error('Failed to load integrations');
      setIntegrations(await res.json());
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
    }
  }

  function handleLogout() {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  }

  function openAddProject() {
    setEditingProject(null);
    setShowProjectForm(true);
  }

  function openEditProject(project) {
    setEditingProject(project);
    setShowProjectForm(true);
  }

  function openAddIntegration() {
    setEditingIntegration(null);
    setShowIntegrationForm(true);
  }

  function openEditIntegration(integration) {
    setEditingIntegration(integration);
    setShowIntegrationForm(true);
  }

  function handleProjectSaved(saved) {
    setProjects((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
    });
    setShowProjectForm(false);
  }

  function handleIntegrationSaved(saved) {
    setIntegrations((prev) => {
      const exists = prev.find((i) => i.id === saved.id);
      return exists ? prev.map((i) => (i.id === saved.id ? { ...i, title: saved.title, description: saved.description } : i)) : [...prev, saved];
    });
    setShowIntegrationForm(false);
  }

  async function handleDeleteProject(id) {
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

  async function handleDeleteIntegration(id) {
    if (!window.confirm('Delete this integration?')) return;
    try {
      const res = await fetch(`/api/integrations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete failed');
      setIntegrations((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h2>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('projects')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'projects'
                ? 'border-indigo-600 text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'integrations'
                ? 'border-indigo-600 text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Integrations
          </button>
        </div>
      </div>

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div>
          <div className="mb-4">
            <button
              onClick={openAddProject}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              + Add Project
            </button>
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
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Status</th>
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
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            project.is_active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {project.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditProject(project)}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id)}
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

          {showProjectForm && (
            <ProjectForm
              project={editingProject}
              onSave={handleProjectSaved}
              onClose={() => setShowProjectForm(false)}
            />
          )}
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div>
          <div className="mb-4">
            <button
              onClick={openAddIntegration}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              + Add Integration
            </button>
          </div>

          {integrations.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 py-12 text-center">No integrations yet. Add one!</p>
          )}

          {integrations.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 font-medium">Icon</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Description</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {integrations.map((integration) => (
                    <tr key={integration.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <img
                          src={integration.iconUrl}
                          alt={integration.title}
                          className="w-10 h-10 object-contain rounded"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{integration.title}</td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {integration.description}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditIntegration(integration)}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteIntegration(integration.id)}
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

          {showIntegrationForm && (
            <IntegrationForm
              integration={editingIntegration}
              onSave={handleIntegrationSaved}
              onClose={() => setShowIntegrationForm(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

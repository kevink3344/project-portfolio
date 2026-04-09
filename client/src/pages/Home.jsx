import { useEffect, useState } from 'react';
import ProjectCard from '../components/ProjectCard';

const APP_TYPES = ['Pro-Code Apps', 'Model-Driven Apps', 'Canvas Apps', 'Prototype Apps'];

function getAppTypeLabel(appType) {
  return appType === 'Pro-Code Apps' ? 'Code Apps' : appType;
}

function getOrderStorageKey(appType) {
  return `portfolio-project-order-${appType}`;
}

function applySavedOrderByType(projects, appType) {
  try {
    const raw = localStorage.getItem(getOrderStorageKey(appType));
    const typedProjects = projects.filter((project) => project.app_type === appType);
    if (!raw) return typedProjects;

    const savedOrder = JSON.parse(raw);
    if (!Array.isArray(savedOrder)) return typedProjects;

    const projectById = new Map(typedProjects.map((project) => [project.id, project]));
    const ordered = [];

    for (const id of savedOrder) {
      if (projectById.has(id)) {
        ordered.push(projectById.get(id));
        projectById.delete(id);
      }
    }

    return [...ordered, ...projectById.values()];
  } catch {
    return projects.filter((project) => project.app_type === appType);
  }
}

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [selectedTab, setSelectedTab] = useState(APP_TYPES[0]);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load projects');
        return res.json();
      })
      .then((data) => setProjects(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredProjects = applySavedOrderByType(projects, selectedTab);

  function handleDrop(targetId) {
    if (draggedId === null || draggedId === targetId) return;

    const fromIndex = filteredProjects.findIndex((project) => project.id === draggedId);
    const toIndex = filteredProjects.findIndex((project) => project.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reorderedFiltered = [...filteredProjects];
    const [moved] = reorderedFiltered.splice(fromIndex, 1);
    reorderedFiltered.splice(toIndex, 0, moved);

    localStorage.setItem(
      getOrderStorageKey(selectedTab),
      JSON.stringify(reorderedFiltered.map((project) => project.id))
    );

    setProjects((prev) => {
      const next = [...prev];

      // Reinsert reordered projects back into their original positions for the selected tab only.
      let reorderIndex = 0;
      for (let i = 0; i < next.length; i += 1) {
        if (next[i].app_type === selectedTab) {
          next[i] = reorderedFiltered[reorderIndex];
          reorderIndex += 1;
        }
      }

      return next;
    });

    setDraggedId(null);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="text-gray-400 dark:text-gray-500 animate-pulse">Loading projects…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center py-24">
        <span className="text-red-500">{error}</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-gray-400 dark:text-gray-500">
        <p className="text-lg font-medium">No projects yet</p>
        <p className="text-sm">Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-6 border-b border-gray-200 dark:border-gray-700">
        {APP_TYPES.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSelectedTab(tab)}
            className={`pb-2 text-sm font-semibold transition-colors border-b-2 ${
              selectedTab === tab
                ? 'border-blue-600 text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {getAppTypeLabel(tab)}
          </button>
        ))}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-gray-400 dark:text-gray-500">
          <p className="text-lg font-medium">No projects in {getAppTypeLabel(selectedTab)}</p>
          <p className="text-sm">Add projects in Admin and assign this app type.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              draggable
              onDragStart={() => setDraggedId(project.id)}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(project.id)}
              className={draggedId === project.id ? 'h-full opacity-70 cursor-grabbing' : 'h-full cursor-grab'}
            >
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

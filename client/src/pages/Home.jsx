import { useEffect, useState } from 'react';
import ProjectCard from '../components/ProjectCard';

const ORDER_STORAGE_KEY = 'portfolio-project-order';

function applySavedOrder(fetchedProjects) {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return fetchedProjects;

    const savedOrder = JSON.parse(raw);
    if (!Array.isArray(savedOrder)) return fetchedProjects;

    const projectById = new Map(fetchedProjects.map((project) => [project.id, project]));
    const ordered = [];

    for (const id of savedOrder) {
      if (projectById.has(id)) {
        ordered.push(projectById.get(id));
        projectById.delete(id);
      }
    }

    // Append new projects that were not present in saved local order.
    return [...ordered, ...projectById.values()];
  } catch {
    return fetchedProjects;
  }
}

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load projects');
        return res.json();
      })
      .then((data) => setProjects(applySavedOrder(data)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleDrop(targetId) {
    if (draggedId === null || draggedId === targetId) return;

    setProjects((prev) => {
      const fromIndex = prev.findIndex((project) => project.id === draggedId);
      const toIndex = prev.findIndex((project) => project.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next.map((project) => project.id)));
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
      {projects.map((project) => (
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
  );
}

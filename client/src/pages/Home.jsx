import { useEffect, useState } from 'react';
import ProjectCard from '../components/ProjectCard';

export default function Home() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

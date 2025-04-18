import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';

export async function GET() {
	const projects = await getCollection('projects');
	const site = 'https://hacklabesgi.netlify.app/';

	return rss({
		title: 'Projets - HackLab',
		description: 'Nos projets en cours ou passés.',
		site,
		items: projects.map((project) => ({
			title: project.data.title,
			pubDate: project.data.date,
			link: `/projects/${project.id}`,
			description: project.data.description,
		  })),
	});
}

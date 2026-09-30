import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';

export async function GET(context: APIContext) {
	const projects = await getCollection('projects', (project) => !project.data.draft);

	return rss({
		title: 'Projets - HackLab',
		description: 'Nos projets en cours ou passés.',
		site: context.site!,
		items: projects.map((project) => ({
			title: project.data.title,
			pubDate: project.data.date,
			link: `/projects/${project.id}`,
			description: project.data.description,
		  })),
	});
}

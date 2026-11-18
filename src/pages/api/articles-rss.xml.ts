import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { isVisible } from '../../lib/drafts';

export async function GET(context: APIContext) {
	const articles = await getCollection('posts', isVisible);

	return rss({
		title: 'Articles - HackLab',
		description: 'Les derniers articles publiés par les membres du HackLab.',
		site: context.site!,
		items: articles.map((article) => ({
			title: article.data.title,
			pubDate: article.data.createdAt, // ou createdAt
			link: `/blog/${article.id}`,
			description: article.data.description,
		})),
	});
}

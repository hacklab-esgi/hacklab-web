import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';

export async function GET() {
	const articles = await getCollection('posts');
	const site = 'https://hacklabesgi.netlify.app/';

	return rss({
		title: 'Articles - HackLab',
		description: 'Les derniers articles publiés par les membres du HackLab.',
		site,
		items: articles.map((article) => ({
			title: article.data.title,
			pubDate: article.data.createdAt, // ou createdAt
			link: `/blog/${article.id}`,
			description: article.data.description,
		})),
	});
}

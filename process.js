const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const sanitize = require('sanitize-filename');
const TurndownService = require('turndown');
const { format } = require('date-fns');

async function processMovieFeed(url) {
  try {
    // Fetch and parse the RSS feed
    const feedData = await fetchAndParseFeed(url);

    let entries = feedData?.rss?.channel?.[0]?.item || [];

    // Process the feed entries and generate Markdown files
    entries.forEach((entry) => {
      try {
        const { output, date, title } = generateFeedMarkdown(entry);
        const filePath = saveMarkdown(date, title, output);

        console.log(`Markdown file '${filePath}' created.`);
      } catch (error) {
        console.error(`Error processing feed entry for ${url}`);
        console.error(error.message);
      }
    });
  } catch (error) {
    console.error(`Error processing feed at ${url}`);
    console.error(error.message);
  }
}

// Fetch the RSS feed
async function fetchAndParseFeed(feedUrl) {
  const response = await axios.get(feedUrl);
  const feedData = response.data;

  if (typeof feedData === 'object') {
    // Assume it's a JSON feed
    return feedData;
  } else {
    // Assume it's an XML feed (RSS or Atom)
    return parseStringPromise(feedData);
  }
}

// Main function for generating Markdown
const generateFeedMarkdown = (entry) => {
  // Get the id
  const id = entry.guid?.[0] || '';

  // Set the date watched
  let date = entry['letterboxd:watchedDate']?.[0] || '';
  date = format(new Date(date), 'yyyy-MM-dd');

  // Get the movie url
  const link = entry.link?.[0] || '';

  // Get the movie title
  const title = entry['letterboxd:filmTitle']?.[0] || '';

  // Get the description
  const content = entry.description?.[0] || '';

  // Extract the Letterboxd image as a cover image
  let regExp = /src="([^"]+)"/;
  let matches = content.match(regExp);
  let cover = matches?.[1];
  console.log(`Cover image: ${cover}`);

  // Convert the content into Markdown
  const markdown = new TurndownService({
    codeBlockStyle: 'fenced',
    fenced: '```',
    bulletListMarker: '-',
  }).turndown(content);

  // Extract author, handling possible formats across feed types
  const author = entry['dc:creator']?.[0] || 'Unknown Author';

  // Final output preparation
  return generateOutput({
    id,
    date,
    link: link.trim(),
    title,
    cover,
    markdown,
    author,
  });
};

// Helper function to generate the output
const generateOutput = (data) => {
  // Get the template file
  const template = fs.readFileSync('./includes/templates/letterboxd.md', 'utf8');

  // Replace with the data entry
  const output = template
    .replaceAll('[ID]', data.id || '')
    .replaceAll('[DATE]', data.date || '')
    .replaceAll('[LINK]', data.link || '')
    .replaceAll('[TITLE]', data.title.replace(/[^\w\s-]/g, '') || '')
    .replaceAll('[COVER]', data.cover || '')
    .replaceAll('[MARKDOWN]', data.markdown || '')
    .replaceAll('[AUTHOR]', data.author || '');

  return { output, date: data.date || '', title: data.title || '' };
};

function saveMarkdown(date, title, markdown) {
  // Set the output directory
  let outputDir = 'src/media/';

  let pubdate = new Date(date);
  let year = pubdate.getFullYear().toString();
  let month = (pubdate.getMonth() + 1).toString().padStart(2, '0');
  const slug = sanitize(`${title.toLowerCase().replace(/\s+/g, '-')}`).substring(0, 50);
  const fileName = `${slug}.md`;

  year = path.join(outputDir, year);
  if (!fs.existsSync(year)) {
    fs.mkdirSync(year, { recursive: true });
    console.log(`Output directory '${year}' created.`);
  }

  month = path.join(year, month);
  if (!fs.existsSync(month)) {
    fs.mkdirSync(month, { recursive: true });
    console.log(`Output directory '${month}' created.`);
  }

  const filePath = path.join(month, fileName);

  if (fs.existsSync(filePath)) {
    console.log(`File ${filePath} already exists`);
  } else {
    console.log(`Writing ${filePath}`);
    fs.writeFileSync(filePath, markdown);
  }

  return filePath;
}

module.exports = {
  processMovieFeed,
};

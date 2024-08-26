import { config } from '../config.js';

export default {
  async fetch(request, env, ctx) {
    try {
      console.log("Worker started");
      const url = new URL(request.url);
      console.log(`Processing request for: ${url.pathname}`);
      console.log("Incoming request headers:", Object.fromEntries(request.headers));

      // Skip processing for service worker and other non-HTML resources
      if (url.pathname.includes('serviceworker.js') || !url.pathname.endsWith('.html')) {
        console.log(`Skipping processing for: ${url.pathname}`);
        return fetch(request);
      }

      const domainSource = config.domainSource;
      console.log(`Domain source: ${domainSource}`);

      console.log(`Fetching content from: ${domainSource}${url.pathname}`);
      const sourceResponse = await fetch(`${domainSource}${url.pathname}`);
      console.log(`Source response status: ${sourceResponse.status}`);
      console.log("Source response headers:", Object.fromEntries(sourceResponse.headers));

      const headers = new Headers(sourceResponse.headers);
      headers.set('X-Worker-Executed', 'true');
      headers.set('Cache-Control', 'no-store, must-revalidate');
      headers.set('x-robots-tag', 'index, follow');

      console.log("Final response headers:", Object.fromEntries(headers));

      return new Response(sourceResponse.body, {
        status: sourceResponse.status,
        statusText: sourceResponse.statusText,
        headers: headers
      });

    } catch (error) {
      console.error("Worker threw an exception:", error.message);
      console.error("Error stack:", error.stack);
      return new Response(`Worker Error: ${error.message}`, { 
        status: 500,
        headers: {
          'X-Worker-Executed': 'true',
          'x-robots-tag': 'noindex',
          'Cache-Control': 'no-store, must-revalidate',
          'Content-Type': 'text/plain'
        }
      });
    }
  }
};

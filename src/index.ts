import { config } from '../config.js';

export default {
  async fetch(request, env, ctx) {
    try {
      console.log("Worker started");
      console.log("Incoming request headers:", Object.fromEntries(request.headers));

      const url = new URL(request.url);
      const domainSource = config.domainSource;
      const patterns = config.patterns;

      // Existing helper functions remain unchanged
      function getPatternConfig(url) { /* ... */ }
      function isPageData(url) { /* ... */ }
      async function requestMetadata(url, metaDataEndpoint) { /* ... */ }

      const patternConfig = getPatternConfig(url.pathname);
      if (patternConfig) {
        console.log("Dynamic page detected:", url.pathname);
        let source = await fetch(`${domainSource}${url.pathname}`);
        console.log("Source response headers:", Object.fromEntries(source.headers));

        const metadata = await requestMetadata(url.pathname, patternConfig.metaDataEndpoint);
        console.log("Metadata fetched:", metadata);

        // New logging to verify metadata
        console.log("Applying metadata to HTML:");
        console.log("Title:", metadata.title);
        console.log("Description:", metadata.description);
        console.log("Image:", metadata.image);
        console.log("Keywords:", metadata.keywords);

        const customHeaderHandler = new CustomHeaderHandler(metadata);
        const transformedResponse = new HTMLRewriter()
          .on('*', customHeaderHandler)
          .transform(source);

        const headers = new Headers(transformedResponse.headers);
        
        headers.set('X-Worker-Executed', 'true');
        headers.set('Cache-Control', 'no-store, must-revalidate');
        headers.set('x-robots-tag', 'index, follow');

        console.log("Final response headers:", Object.fromEntries(headers));

        return new Response(transformedResponse.body, {
          status: transformedResponse.status,
          statusText: transformedResponse.statusText,
          headers: headers
        });
      } else if (isPageData(url.pathname)) {
        // Existing page data handling remains unchanged
        // ...
      }

      // Existing fallback handling remains unchanged
      // ...

    } catch (error) {
      console.error("Worker threw an exception:", error.message);
      console.error("Error stack:", error.stack);
      return new Response(`Worker Error: ${error.message}`, { 
        status: 500,
        headers: {
          'X-Worker-Executed': 'true',
          'x-robots-tag': 'noindex',
          'Cache-Control': 'no-store, must-revalidate'
        }
      });
    }
  }
};

class CustomHeaderHandler {
  constructor(metadata) {
    this.metadata = metadata;
  }

  element(element) {
    if (element.tagName === "title") {
      console.log('Found title tag, current content:', element.textContent);
      element.setInnerContent(this.metadata.title);
      console.log('Set new title content:', this.metadata.title);
    }
    if (element.tagName === "meta") {
      const name = element.getAttribute("name");
      const property = element.getAttribute("property");
      console.log(`Found meta tag: name=${name}, property=${property}`);
      
      if (name === "description") {
        console.log('Updating description meta tag');
        element.setAttribute("content", this.metadata.description);
      } else if (name === "keywords") {
        console.log('Updating keywords meta tag');
        element.setAttribute("content", this.metadata.keywords);
      } else if (property === "og:title") {
        console.log('Updating og:title meta tag');
        element.setAttribute("content", this.metadata.title);
      } else if (property === "og:description") {
        console.log('Updating og:description meta tag');
        element.setAttribute("content", this.metadata.description);
      } else if (property === "og:image") {
        console.log('Updating og:image meta tag');
        element.setAttribute("content", this.metadata.image);
      } else if (name === "twitter:title") {
        console.log('Updating twitter:title meta tag');
        element.setAttribute("content", this.metadata.title);
      } else if (name === "twitter:description") {
        console.log('Updating twitter:description meta tag');
        element.setAttribute("content", this.metadata.description);
      } else if (name === "robots") {
        console.log('Updating robots meta tag');
        element.setAttribute("content", "index, follow");
      }
      
      console.log(`Updated meta tag content:`, element.getAttribute("content"));
    }
  }
}

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
      function getPatternConfig(url) {
        for (const patternConfig of patterns) {
          const regex = new RegExp(patternConfig.pattern);
          let pathname = url + (url.endsWith('/') ? '' : '/');
          if (regex.test(pathname)) {
            return patternConfig;
          }
        }
        return null;
      }

      function isPageData(url) {
        const pattern = /\/public\/data\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json/;
        return pattern.test(url);
      }

      async function requestMetadata(url, metaDataEndpoint) {
        try {
          const trimmedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
          const parts = trimmedUrl.split('/');
          const id = parts[parts.length - 1];
          const placeholderPattern = /{([^}]+)}/;
          const metaDataEndpointWithId = metaDataEndpoint.replace(placeholderPattern, id);
          
          console.log(`Fetching metadata from: ${metaDataEndpointWithId}`);
          const metaDataResponse = await fetch(metaDataEndpointWithId);
          const metadata = await metaDataResponse.json();
          
          if (metadata.code === "ERROR_FATAL") {
            console.error("Metadata fetch error:", metadata.message);
            return {
              title: "Default Title",
              description: "Default Description",
              image: "https://example.com/default-image.jpg",
              keywords: "default, keywords"
            };
          }
          
          console.log("Metadata fetched successfully:", metadata);
          return metadata;
        } catch (error) {
          console.error("Error in requestMetadata:", error);
          return {
            title: "Error Title",
            description: "An error occurred while fetching metadata",
            image: "https://example.com/error-image.jpg",
            keywords: "error, metadata"
          };
        }
      }

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
      console.log("Fetching original content for:", url.pathname);
      const sourceResponse = await fetch(`${domainSource}${url.pathname}`);
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

import { config } from '../config.js';

export default {
  async fetch(request, env, ctx) {
    // Extracting configuration values
    const domainSource = config.domainSource;
    const patterns = config.patterns;

    console.log("Worker started");
    console.log("Incoming request headers:", Object.fromEntries(request.headers));

    // Parse the request URL
    const url = new URL(request.url);
    const referer = request.headers.get('Referer')

    // ... (existing functions remain unchanged)

    // Handle dynamic page requests
    const patternConfig = getPatternConfig(url.pathname);
    if (patternConfig) {
      console.log("Dynamic page detected:", url.pathname);

      // Fetch the source page content
      let source = await fetch(`${domainSource}${url.pathname}`);
      console.log("Source response headers:", Object.fromEntries(source.headers));

      const metadata = await requestMetadata(url.pathname, patternConfig.metaDataEndpoint);
      console.log("Metadata fetched:", metadata);

      // Create a custom header handler with the fetched metadata
      const customHeaderHandler = new CustomHeaderHandler(metadata);

      // Transform the source HTML with the custom headers
      const transformedResponse = new HTMLRewriter()
        .on('*', customHeaderHandler)
        .transform(source);

      console.log("Transformed response headers:", Object.fromEntries(transformedResponse.headers));
      return transformedResponse;

    // Handle page data requests for the WeWeb app
    } else if (isPageData(url.pathname)) {
      console.log("Page data detected:", url.pathname);
      console.log("Referer:", referer);

      // Fetch the source data content
      const sourceResponse = await fetch(`${domainSource}${url.pathname}`);
      console.log("Source data response headers:", Object.fromEntries(sourceResponse.headers));
      let sourceData = await sourceResponse.json();

      // ... (existing page data handling code)

      console.log("returning file: ", JSON.stringify(sourceData));
      // Return the modified JSON object
      const response = new Response(JSON.stringify(sourceData), {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log("Final page data response headers:", Object.fromEntries(response.headers));
      return response;
    }

    // If the URL does not match any patterns, fetch and return the original content
    console.log("Fetching original content for:", url.pathname);
    const sourceUrl = new URL(`${domainSource}${url.pathname}`);
    const sourceRequest = new Request(sourceUrl, request);
    const sourceResponse = await fetch(sourceRequest);
    console.log("Final response headers:", Object.fromEntries(sourceResponse.headers));

    return sourceResponse;
  }
};

// CustomHeaderHandler class remains unchanged
class CustomHeaderHandler {
  // ... (existing code)
}

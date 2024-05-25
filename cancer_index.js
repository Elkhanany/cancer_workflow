const fs = require('fs');
const { Transformer } = require('markmap-lib');
const { fillTemplate } = require('markmap-render');

// Replace this with your Markdown file path
const markdownPath = './cancer_workflow.md';
// Replace this with your desired output HTML file path
const outputPath = './index.html';

// Read Markdown file
const markdown = fs.readFileSync(markdownPath, 'utf-8');

// Transform Markdown to Markmap data
const transformer = new Transformer();
const { root, features } = transformer.transform(markdown);

// Get assets
const assets = transformer.getUsedAssets(features);

// Define JSON options
const jsonOptions = {
  initialExpandLevel: 3, // Collapse all nodes
  maxWidth: 200 // Set max width for text wrapping
};

// Generate HTML
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="ie=edge">
<title>Markmap</title>
<style>
* {
  margin: 0;
  padding: 0;
}
#mindmap {
  display: block;
  width: 100vw;
  height: 100vh;
}
</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/markmap-toolbar@0.17.0/dist/style.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
</head>
<body>
<svg id="mindmap"></svg>
<script src="https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/markmap-view@0.17.0/dist/browser/index.js"></script>
<script src="https://cdn.jsdelivr.net/npm/markmap-toolbar@0.17.0/dist/index.js"></script>
<script>
window.WebFontConfig = {
  custom: {
    families: [
      "KaTeX_AMS","KaTeX_Caligraphic:n4,n7","KaTeX_Fraktur:n4,n7",
      "KaTeX_Main:n4,n7,i4,i7","KaTeX_Math:i4,i7","KaTeX_Script",
      "KaTeX_SansSerif:n4,n7,i4","KaTeX_Size1","KaTeX_Size2",
      "KaTeX_Size3","KaTeX_Size4","KaTeX_Typewriter"
    ],
    active: function() {
      window.markmap.refreshHook.call();
    }
  }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/webfontloader@1.6.28/webfontloader.js" defer></script>
<script>
(() => {
  setTimeout(() => {
    const { markmap: Markmap, mm: markmapInstance } = window;
    const toolbar = new Markmap.Toolbar();
    toolbar.attach(markmapInstance);
    const toolbarElement = toolbar.render();
    toolbarElement.style.position = 'absolute';
    toolbarElement.style.bottom = '20px';
    toolbarElement.style.right = '20px';
    document.body.append(toolbarElement);
  });

  ((getMarkmap, getOptions, root, jsonOptions) => {
    const markmap = getMarkmap();
    window.mm = markmap.Markmap.create(
      "svg#mindmap",
      (getOptions || markmap.deriveOptions)(jsonOptions),
      root
    );
  })(() => window.markmap, null, ${JSON.stringify(root)}, ${JSON.stringify(jsonOptions)});
})();
</script>
</body>
</html>
`;

// Write HTML to file
fs.writeFileSync(outputPath, htmlContent);

console.log('Interactive Markmap HTML generated:', outputPath);

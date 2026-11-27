export const svgUri = body => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='300' viewBox='0 0 480 300' font-family='Helvetica,Arial,sans-serif'><rect width='480' height='300' fill='#fff'/>${body}</svg>`);

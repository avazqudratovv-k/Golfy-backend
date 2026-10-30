import express from "express";

// uploaded files are served as inert content (no script execution, no sniffing)
export const serveUploads = express.static("./uploads", {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"
    );
  },
});

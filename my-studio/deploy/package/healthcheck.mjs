const port = process.env.PORT || '8788';
try { const response = await fetch('http://127.0.0.1:' + port + '/.well-known/oauth-protected-resource'); if (!response.ok) process.exitCode = 1; } catch { process.exitCode = 1; }

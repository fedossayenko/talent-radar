#!/bin/sh

# Replace environment variables in JavaScript files
# This allows runtime configuration of the built React app

echo "🚀 Starting Nginx with environment variable substitution..."

# Create a temporary directory for processed files
mkdir -p /tmp/assets

# Find all JS files in the build output
find /usr/share/nginx/html -name "*.js" -type f | while read -r file; do
    echo "📝 Processing: $file"
    
    # Create relative path for temp file
    relative_path=${file#/usr/share/nginx/html/}
    temp_file="/tmp/assets/$relative_path"
    
    # Create directory structure in temp
    mkdir -p "$(dirname "$temp_file")"
    
    # Replace environment variables
    envsubst '${VITE_API_URL} ${VITE_APP_NAME} ${VITE_APP_VERSION}' < "$file" > "$temp_file"
    
    # Copy back to original location
    cp "$temp_file" "$file"
done

# Also process index.html if it contains env vars
if [ -f /usr/share/nginx/html/index.html ]; then
    echo "📝 Processing: /usr/share/nginx/html/index.html"
    envsubst '${VITE_API_URL} ${VITE_APP_NAME} ${VITE_APP_VERSION}' < /usr/share/nginx/html/index.html > /tmp/index.html
    cp /tmp/index.html /usr/share/nginx/html/index.html
fi

# Clean up temp directory
rm -rf /tmp/assets /tmp/index.html

echo "✅ Environment variable substitution completed"
echo "🌐 API URL: ${VITE_API_URL:-'Not set'}"
echo "📱 App Name: ${VITE_APP_NAME:-'Not set'}"
echo "🏷️  Version: ${VITE_APP_VERSION:-'Not set'}"

# Execute the original command (nginx)
exec "$@"
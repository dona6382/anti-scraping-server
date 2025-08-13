#!/bin/bash

echo "🔄 Installing Swagger dependencies..."

cd /Users/marqvision/Desktop/kch/anti-scraping-server

# Install @nestjs/swagger
npm install @nestjs/swagger@^7.1.10

echo "✅ Swagger installation complete!"
echo ""
echo "📚 Swagger documentation will be available at:"
echo "   👉 http://localhost:3000/api-docs"
echo ""
echo "🔄 Please restart your development server:"
echo "   npm run start:dev"
echo ""

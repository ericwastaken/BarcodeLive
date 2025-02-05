
# Barcode Live

A modern, responsive PDF417 barcode scanner web application built with React, TypeScript, and Tailwind CSS. This project uses the `@zxing/browser` library for PDF417 barcode detection and features a clean, professional UI with customizable scanner settings.

## Features

- Real-time PDF417 barcode scanning using device camera
- Clean, modern UI built with shadcn/ui components
- Responsive design that works on both desktop and mobile
- Customizable scanner settings, including cooldown time in between scans, regex data matching and camera stream horizontal/vertical flip
- Toast notifications for errors
- Built with TypeScript for type safety

## Getting Started

1. Clone this repository
2. Install dependencies:
```bash
npm install
```
3. Start the development server:
```bash
npm run dev
```
4. Open your browser to view the application

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite
- shadcn/ui components
- @zxing/browser for PDF417 barcode scanning
- Radix UI primitives

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── scanner/     # Barcode scanner components
│   │   └── ui/          # UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   └── pages/           # Application pages
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [@zxing/browser](https://github.com/zxing-js/browser) for PDF417 barcode scanning capabilities
- [Tailwind CSS](https://tailwindcss.com/) for styling

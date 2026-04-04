# Contributing to Gamepad Bridge

Welcome, and thank you for your interest in contributing to the MacPad Gamepad Bridge! This guide will help you get started.

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please create an issue on GitHub with:
- A clear descriptive title.
- Steps to reproduce the issue.
- Details about your environment (iOS version, macOS version).

### Suggesting Enhancements
If you have ideas to improve the project:
- Check existing issues to see if it's already been requested.
- Open a new issue detailing the feature and its intended use case.

### Pull Requests
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/amazing-feature`).
3. Make your changes in the appropriate directory:
   - Modifications to the Web UI should happen in `/frontend`
   - Modifications to the Mac daemon should happen in `/host_daemon`
4. Commit your changes (`git commit -m 'Add some amazing feature'`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

## Development Setup

Please refer to the `README.md` for instructions on running the environment using Docker and Python.

### Frontend
Built with React and Vite. 
```bash
cd frontend
npm install
npm run dev
```

### Backend
Built with FastAPI and pynput.
```bash
cd host_daemon
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 server.py
```

Thank you for helping make Gamepad Bridge better!

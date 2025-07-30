## ChainGPT UI Demo

### Clone the repository:

1. Clone the repository -

```sh
git clone https://github.com/neonlabsorg/neon-pocs.git
cd neon-pocs
```

2. Switch to the demo branch -

```sh
gh pr checkout 7
```

### Build and Run the Frontend

1. Install dependencies:

```bash
cd frontend/chaingpt-ui
yarn install
```

2. Configure environment variables:

```sh
cp .env.example .env
# Edit .env with your configuration
```

3. Start development server:

```bash
yarn dev
```

### Running the Demo

1. Open the frontend application in your browser (typically at http://localhost:5173)
2. Connect your Solana wallet (Phantom or another compatible wallet)

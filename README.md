# promptcage

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> Using this package requires an API key from [PromptCage.com](https://promptcage.com/)

## Install

```bash
npm install promptcage
```

## Usage

### Basic Usage

```ts
import { PromptCage } from 'promptcage';

// Initialize with API key from PROMPTCAGE_API_KEY environment variable
const promptCage = new PromptCage();

// Or initialize with API key directly
const promptCage = new PromptCage('your-api-key-here');

// Or initialize with options object
const promptCage = new PromptCage({ 
  apiKey: 'your-api-key-here',
  maxWaitTime: 1000 // 1 second max wait time
});

// Detect prompt injection
const result = await promptCage.detectInjection('Your user input here');

console.log(result);
//=> { safe: true, detectionId: 'det_123456', error: undefined }
```

### Advanced Usage with Metadata

```ts
import { PromptCage } from 'promptcage';

const promptCage = new PromptCage({ 
  apiKey: 'your-api-key',
  maxWaitTime: 3000 // 3 seconds max wait time (custom)
});

const result = await promptCage.detectInjection(
  'Your user input here',
  'user-123', // optional anonymous user ID
  {
    source: 'web-app',
    version: '1.0',
    sessionId: 'sess_456'
  } // optional metadata
);

if (result.safe) {
  console.log('Prompt is safe to use');
} else {
  console.log('Potential prompt injection detected!');
  console.log('Detection ID:', result.detectionId);
  if (result.error) {
    console.log('Error:', result.error);
  }
}
```

## Environment Variables

Set your API key as an environment variable:

```bash
export PROMPTCAGE_API_KEY=your-api-key-here
```

## API

### PromptCage

The main class for interacting with the PromptCage API.

#### constructor(options?)

- `options` (optional): Configuration object or API key string
  - `apiKey` (optional): Your PromptCage API key. If not provided, will use `PROMPTCAGE_API_KEY` environment variable
  - `maxWaitTime` (optional): Maximum wait time in milliseconds before treating request as safe (default: 1000ms)

#### detectInjection(prompt, userAnonId?, metadata?)

Detects potential prompt injection in the given text.

- `prompt` (required): The text to analyze for prompt injection
- `userAnonId` (optional): Anonymous user identifier for tracking
- `metadata` (optional): Additional metadata object

Returns a `Promise<DetectionResponse>` with:
- `safe`: Boolean indicating if the prompt is safe
- `detectionId`: Unique identifier for this detection
- `error`: Error message if something went wrong (optional)

### Fail-Safe Behavior

The package is designed to be **fail-safe** and will never block your application. The SDK **fails open** in all error scenarios (Network errors, Rate limit exceeded, Quota exceeded ...).

**Important**: In all error cases, `safe` will be `true` and `error` will contain the error message. This ensures your application continues to work even when the PromptCage API is down, slow, or experiencing issues.

### Error Handling

The SDK always returns `safe: true` in error cases, but you can still check for errors:

```ts
const result = await promptCage.detectInjection('Your user input here');

if (result.safe) {
  if (result.error) {
    // API had an issue, but we're treating it as safe
    console.log('Warning:', result.error);
    // You might want to log this for monitoring
  } else {
    // API confirmed the prompt is safe
    console.log('Prompt is safe');
  }
} else {
  // API detected prompt injection
  console.log('Prompt injection detected!');
  console.log('Detection ID:', result.detectionId);
}
```

### Performance Considerations

The `maxWaitTime` option helps prevent performance impact on your application:

```ts
// Fast response for performance-critical apps
const promptCage = new PromptCage({ 
  apiKey: 'your-key', 
  maxWaitTime: 100 // 100ms max wait
});

// Longer wait for slower networks
const promptCage = new PromptCage({ 
  apiKey: 'your-key', 
  maxWaitTime: 10000 // 10 seconds max wait
});
```

[build-img]:https://github.com/devndeploy/promptcage/actions/workflows/release.yml/badge.svg
[build-url]:https://github.com/devndeploy/promptcage/actions/workflows/release.yml
[npm-img]:https://img.shields.io/npm/v/promptcage
[npm-url]:https://www.npmjs.com/package/promptcage
[issues-img]:https://img.shields.io/github/issues/devndeploy/promptcage
[issues-url]:https://github.com/devndeploy/promptcage/issues
[codecov-img]:https://codecov.io/gh/devndeploy/promptcage/branch/main/graph/badge.svg
[codecov-url]:https://codecov.io/gh/devndeploy/promptcage
[semantic-release-img]:https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]:https://github.com/semantic-release/semantic-release
[commitizen-img]:https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]:http://commitizen.github.io/cz-cli/

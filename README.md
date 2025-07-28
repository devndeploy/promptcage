# promptcage

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> Using this package requires an API key from [PromptCage.com](https://promptcage.com/)

## 📦 Install

```bash
npm install promptcage
```

## 🚀 Basic Usage

```ts
import { PromptCage } from 'promptcage';

// Initialize with API key from PROMPTCAGE_API_KEY environment variable
const promptCage = new PromptCage();

// Detect prompt injection
const result = await promptCage.detectInjection('Your user input here');

if (!result.safe) {
  console.log('Prompt injection detected!');
  return 'I cannot process this request due to security concerns.';
}

// Canary token testing
const [systemPromptWithCanary, canaryWord] = promptCage.addCanaryWord(
  'You are a helpful assistant. Answer user questions accurately and concisely.'
);

// Send to your AI model with canary in system prompt
const aiResponse = await yourAiModel.complete({
  systemPrompt: systemPromptWithCanary,
  userPrompt: 'What is the capital of France?'
});

// Check for canary leakage
const leakageResult = promptCage.isCanaryWordLeaked(aiResponse, canaryWord);
if (leakageResult.leaked) {
  console.log('Canary token leaked - possible prompt injection!');
  return 'I cannot process this request due to security concerns.';
}

// If we get here, both checks passed
return aiResponse;
```

## 🔧 API

### Constructor

The constructor accepts an optional configuration object.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `options` | `PromptCageOptions` | No | - | Configuration object |
| `options.apiKey` | `string` | No | `process.env.PROMPTCAGE_API_KEY` | Your PromptCage API key |
| `options.maxWaitTime` | `number` | No | `1000` | Maximum wait time in milliseconds before treating request as safe |
| `options.defaultCanaryLength` | `number` | No | `8` | Default canary word length in characters |
| `options.defaultCanaryFormat` | `string` | No | `'<!-- {canary_word} -->'` | Default format for embedding canary words (must contain `{canary_word}` placeholder) |

### detectInjection()

Detects potential prompt injection in the given text.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | Yes | The text to analyze for prompt injection |
| `userAnonId` | `string` | No | Anonymous user identifier for tracking |
| `metadata` | `object` | No | Additional metadata object |

**Returns:** `Promise<DetectionResponse>`

| Property | Type | Description |
|----------|------|-------------|
| `safe` | `boolean` | Boolean indicating if the prompt is safe |
| `detectionId` | `string` | Unique identifier for this detection |
| `error` | `string \| undefined` | Error message if something went wrong (optional) |

### addCanaryWord()

Embeds a canary word into a prompt for injection testing.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | `string` | Yes | The original prompt text |
| `canaryWord` | `string` | No | Specific canary word to use (auto-generated if not provided) |
| `canaryFormat` | `string` | No | Format string with `{canary_word}` placeholder (must contain `{canary_word}`) |

**Returns:** `[string, string]` - Tuple of [prompt with canary, canary word used]

### isCanaryWordLeaked()

Checks if a canary word has been leaked in an AI model's response.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `completion` | `string` | Yes | The AI model's response/completion to check |
| `canaryWord` | `string` | Yes | The canary word to look for |

**Returns:** `CanaryLeakageResult`

| Property | Type | Description |
|----------|------|-------------|
| `leaked` | `boolean` | Whether the canary word was leaked |
| `canaryWord` | `string` | The canary word that was checked |
| `error` | `string \| undefined` | Error message if the check failed (optional) |

## 🛡️ Fail-Safe Behavior

The package is designed to be **fail-safe** and will never block your application. The SDK **fails open** in all error scenarios (Network errors, Rate limit exceeded, Quota exceeded ...).

**Important**: In all error cases, `safe` will be `true` and `error` will contain the error message. This ensures your application continues to work even when the PromptCage API is down, slow, or experiencing issues.

## ⚠️ Error Handling

The SDK always returns `safe: true` in error cases, but you can still check for errors:

```ts
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



## ⚡ Performance Considerations

The `maxWaitTime` option helps prevent performance impact on your application:

```ts
// Fast response for performance-critical apps
const promptCage = new PromptCage({ 
  apiKey: 'your-api-key', 
  maxWaitTime: 100 // 100ms max wait
});

// Longer wait for slower networks
const promptCage = new PromptCage({ 
  apiKey: 'your-api-key', 
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

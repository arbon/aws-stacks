![AWS Resources](https://github.com/arbon/aws-stacks/blob/main/docs/aws-stacks.png?raw=true)

# AWS Stacks

This is an [AWS Cloud Development Kit (CDK)](https://aws.amazon.com/cdk/) project written in TypeScript to define AWS infrastructure. It defines a number of _stacks_ used to create and deploy resources ([S3 Buckets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-bucket.html), [SNS Topics](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-sns-topic.html), etc.) via [AWS CloudFormation Templates](https://aws.amazon.com/cloudformation/resources/templates/). It explores inheritance to share stack resources and standards.

For additional details, please see:

- [AWS Cloud Development Kit / Getting Started](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
- [AWS Cloud Development Kit / Stacks](https://docs.aws.amazon.com/cdk/v2/guide/stacks.html)

## Organization

The basic deployment unit for the CDK is called a _stack_ and is implemented via the [`Stack`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Stack.html) construct. This project contains a number of `Stack` implementations in `lib/stacks`. These are derived from a base `AppStack` class that implement shared features (tags, removal policies, etc.). Some of these subclasses include:

1. `DistributionBucketStack` - Creates Cloudfront distributions with S3 origins via `WebBucketStack`.
2. `EmailTopicStack` - Creates email identities with receipt rules that forward to SNS based on `TopicStack`.
3. `KeyStack` - Creates a new KMS key with rotation.
4. `LogGroupStack` - Creates a CloudWatch log group with KMS key encryption via `KeyStack`.
5. `QueueStack` - Creates a SQS queue subscribed to a topic via `TopicStack`.
6. `RestApiTopicStack` - Creates an API proxied to an SNS topic via `TopicStack`.
7. `TopicStack` - Creates new SNS topics encrypted via KMS keys based on `KeyStack`.
8. `VpcStack` - Creates a VPC with flow logs.

## Installation & Setup

[NPM](https://www.npmjs.com) is used to install package dependencies; these include the [AWS CDK](https://www.npmjs.com/package/aws-cdk).

```bash
npm install
```

Use the CDK command-line to boostrap one ore more AWS regions.

```bash
cdk bootstrap aws://123456789012/us-west-2
cdk bootstrap aws://123456789012/us-west-2 aws://123456789012/us-east-1
```

## Usage

Stack classes may be imported, instantiated, extended, etc.

```typescript
import { TopicStack, TopicStackProps } from './TopicStack'
```

Additionally, a handful of simple, specific implementations are provided in `lib/apps`. Those applications and the stack instances they contain may be invoked via `npm run synth`. The application to create is set via [CDK runtime context](https://docs.aws.amazon.com/cdk/v2/guide/context.html).

Please provide a `apps` context value via `-c` or `--context`. Note: omission of a valid app name will produce a list of available options. Add additional context values as needed.

### Stack Synthesis

The CDK will invoke `createApps` in `bin/index.ts` and synthesize stacks from with apps imported from `lib/apps`.

```bash
npm run synth -- --context apps=keyApp
```

Alternatively:

```bash
cdk synth -c apps=keyApp
```

### Stack Deployment

```bash
npm run deploy -- --context apps=keyApp
```

Alternatively:

```bash
cdk deploy -c apps=bucketApp
```

### Builds

The TypeScript compiler is invoked via `build` or `watch` scripts.
CDK build artifacts in the `cdk.out` directory may be removed via the `clean` script.

```bash
npm run build
npm run watch
npm run clean
```

### Tests & Linting

Documentation may be generated via the `docs` script.
ESLint and Jest are invoked via `lint` and `test` scripts.

```bash
npm run docs
npm run lint
npm run test
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. Please make sure to update tests as appropriate.

## License

Code is available under [MIT License](https://opensource.org/license/mit/).

Copyright (c) 2024 Zach Arbon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

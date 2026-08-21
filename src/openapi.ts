import { PROPOSAL_KINDS } from './types.ts';

const LEVERS = ['thumbnail', 'title', 'hook', 'topic', 'format', 'cadence', 'community'];

const ok = (description: string) => ({ description, content: { 'application/json': {} } });
const channelPath = {
  name: 'channelId',
  in: 'path',
  required: true,
  schema: { type: 'string' },
} as const;

/** Paste this at https://<host>/v1/openapi.json into the Minds chat to build the Skill. */
export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Growth Compass',
    version: '1.0.0',
    description: [
      'System of record for one YouTube channel: metrics, experiments, checkpoints, learnings.',
      '',
      'Rules you must follow:',
      '- Facts about numbers come from this tool, never from recollection.',
      '- ctrPct and impressions lag ~2 days and are null until the reach report lands.',
      '  Never present a null as zero and never guess it.',
      '- A prediction is a commitment: record it before publishing, grade it honestly after.',
      '- Every claim about what works carries its sample size. Below three supporting',
      '  experiments, say plainly that it is not established.',
      '- This API is read-only towards YouTube. You cannot publish, edit or delete anything',
      '  on the channel. Propose changes with POST /v1/proposals; the creator decides.',
    ].join('\n'),
  },
  security: [{ bearer: [] }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
  },
  paths: {
    '/v1/channels': {
      get: { summary: 'List connected channels', responses: { 200: ok('Channels') } },
    },
    '/v1/channels/{channelId}/context': {
      get: {
        summary: 'Session briefing — read this before answering anything',
        description:
          'Recent videos, open experiments with their checkpoints, settled verdicts, ' +
          'confirmed rules and rules still gathering evidence, and how current the CTR data is.',
        parameters: [channelPath],
        responses: { 200: ok('Briefing') },
      },
    },
    '/v1/channels/{channelId}/videos': {
      get: { summary: 'Videos with their latest metrics', parameters: [channelPath], responses: { 200: ok('Videos') } },
    },
    '/v1/videos/{ytVideoId}': {
      get: {
        summary: 'One video with its snapshot history',
        parameters: [{ name: 'ytVideoId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok('Video and history') },
      },
    },
    '/v1/videos/{ytVideoId}/retention': {
      get: {
        summary: 'Audience retention curve and the steepest drop-offs',
        parameters: [{ name: 'ytVideoId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok('Retention') },
      },
    },
    '/v1/experiments': {
      post: {
        summary: 'Open an experiment with a numeric prediction',
        description: 'Passing ytVideoId schedules the t24/t72/t7d/t28d checkpoints automatically.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['channelId', 'lever', 'hypothesis', 'prediction'],
                properties: {
                  channelId: { type: 'string' },
                  ytVideoId: { type: 'string' },
                  lever: { type: 'string', enum: LEVERS },
                  hypothesis: { type: 'string', minLength: 10 },
                  prediction: {
                    type: 'object',
                    additionalProperties: { type: 'number' },
                    description: 'Numeric targets, e.g. {"ctrPct": 5.2, "avgViewPct": 42}',
                  },
                },
              },
            },
          },
        },
        responses: { 201: ok('Experiment and its checkpoints') },
      },
    },
    '/v1/channels/{channelId}/experiments': {
      get: { summary: 'List experiments', parameters: [channelPath], responses: { 200: ok('Experiments') } },
    },
    '/v1/experiments/{id}/attach': {
      post: {
        summary: 'Attach a published video and start its checkpoints',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ytVideoId'], properties: { ytVideoId: { type: 'string' } } } } },
        },
        responses: { 200: ok('Checkpoints') },
      },
    },
    '/v1/experiments/{id}/close': {
      post: {
        summary: 'Close an experiment with a verdict',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['outcome', 'verdict'],
                properties: {
                  outcome: { type: 'object' },
                  verdict: { type: 'string', enum: ['confirmed', 'refuted', 'inconclusive'] },
                },
              },
            },
          },
        },
        responses: { 200: ok('Experiment') },
      },
    },
    '/v1/checkpoints/{id}/observe': {
      post: {
        summary: 'Record your reading of predicted versus observed',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['observation'],
                properties: {
                  observation: {
                    type: 'object',
                    description: 'Include a short "summary" string; the creator reads it.',
                  },
                },
              },
            },
          },
        },
        responses: { 200: ok('Checkpoint') },
      },
    },
    '/v1/channels/{channelId}/learnings': {
      get: { summary: 'Channel rules and their evidence', parameters: [channelPath], responses: { 200: ok('Learnings') } },
    },
    '/v1/learnings': {
      post: {
        summary: 'Record or reinforce a durable learning',
        description:
          'Re-posting the same statement raises its evidence count. Set contradicted:true when ' +
          'an experiment refutes it. Once a learning returns promotable:true, write it into your ' +
          'Soul as a Tenet, then call /v1/learnings/{id}/promoted.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['channelId', 'statement'],
                properties: {
                  channelId: { type: 'string' },
                  statement: { type: 'string', minLength: 10 },
                  lever: { type: 'string', enum: LEVERS, nullable: true },
                  experimentId: { type: 'string', nullable: true },
                  contradicted: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: { 200: ok('Learning') },
      },
    },
    '/v1/learnings/{id}/promoted': {
      post: {
        summary: 'Mark a learning as written into your Soul',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: ok('Learning') },
      },
    },
    '/v1/proposals': {
      post: {
        summary: 'Propose a change for the creator to approve',
        description:
          'The only way to act on the channel. The creator approves or dismisses it in the app; ' +
          'you never execute it yourself. With kind="experiment" you must send `experiment`: ' +
          'each concept carries its own numeric prediction, and approving one opens that ' +
          'experiment with that number on the record and schedules its checkpoints. This is ' +
          'how you commit to a number before anything is published.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['channelId', 'kind', 'summary', 'detail', 'rationale'],
                properties: {
                  channelId: { type: 'string' },
                  ytVideoId: { type: 'string' },
                  kind: { type: 'string', enum: [...PROPOSAL_KINDS] },
                  summary: { type: 'string', maxLength: 140, description: 'One line the creator reads first' },
                  detail: { type: 'string', description: 'The exact copy or change you propose' },
                  rationale: { type: 'string', description: 'Why, grounded in this channel evidence' },
                  options: { type: 'array', items: { type: 'string' }, maxItems: 5 },
                  experiment: {
                    type: 'object',
                    description: 'Required when kind="experiment". Ignored otherwise.',
                    required: ['lever', 'concepts'],
                    properties: {
                      lever: { type: 'string', description: 'What is being varied: title, thumbnail, hook, format, cadence' },
                      ytVideoId: {
                        type: 'string',
                        nullable: true,
                        description: 'Attach a published video to start the checkpoint clock; omit for a concept not yet filmed',
                      },
                      concepts: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 5,
                        items: {
                          type: 'object',
                          required: ['label', 'hypothesis', 'prediction'],
                          properties: {
                            label: { type: 'string', maxLength: 140, description: 'What the creator picks between' },
                            hypothesis: { type: 'string', description: 'The claim this concept tests' },
                            prediction: {
                              type: 'object',
                              additionalProperties: { type: 'number' },
                              description: 'At least one number, e.g. {"ctrPct": 6.2, "avgViewPct": 44}. A concept with no number is rejected.',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: ok('Proposal') },
      },
    },
    '/v1/channels/{channelId}/proposals': {
      get: { summary: 'List proposals and how the creator decided', parameters: [channelPath], responses: { 200: ok('Proposals') } },
    },
    '/v1/channels/{channelId}/chats': {
      get: {
        summary: 'Conversations you have already had, newest first',
        parameters: [channelPath],
        responses: { 200: ok('Threads') },
      },
    },
    '/v1/channels/{channelId}/chats/search': {
      get: {
        summary: 'Recall your own past analysis',
        description:
          'Filter by tag with ref=viewer:<id>,video:<id>,segment:<name>,experiment:<id> and/or ' +
          'free text with q=. Use it before answering so you do not repeat or contradict yourself.',
        parameters: [
          channelPath,
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'ref', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: ok('Matching messages') },
      },
    },
    '/v1/channels/{channelId}/triage': {
      get: { summary: 'Untriaged comments, returning viewers first', parameters: [channelPath], responses: { 200: ok('Comments') } },
    },
    '/v1/comments/{ytCommentId}/triage': {
      post: {
        summary: 'Classify a comment',
        parameters: [{ name: 'ytCommentId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['triage'],
                properties: { triage: { type: 'string', enum: ['superfan', 'question', 'criticism', 'noise'] } },
              },
            },
          },
        },
        responses: { 200: ok('Acknowledged') },
      },
    },
    '/v1/channels/{channelId}/superfans': {
      get: { summary: 'Viewers who keep coming back', parameters: [channelPath], responses: { 200: ok('Superfans') } },
    },
    '/v1/channels/{channelId}/sync': {
      post: { summary: 'Force a refresh from YouTube', parameters: [channelPath], responses: { 200: ok('Sync result') } },
    },
  },
} as const;

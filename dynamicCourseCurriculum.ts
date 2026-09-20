import { Course, Lesson } from './types';

/**
 * Dynamic Course for Cloud & Big Data Engineering.
 *
 * The companion to the stable Cloud & Big Data Engineering course: where the
 * core course teaches foundations that rarely move, this course teaches
 * "what is changing now" — new services and tools, better alternatives,
 * major version changes, deprecations, and emerging practices.
 *
 * DESIGNED FOR FUTURE UPDATES (no update engine in this task): every lesson
 * carries `dynamic` metadata (category, technology, version, introducedAt,
 * lastUpdatedAt, lastReviewedAt, supersedes). A later pipeline
 * (sources → change detection → AI proposal → review → course update) can
 * add, refresh, deprecate, or replace individual lessons by editing those
 * fields and lesson bodies — the course shape never needs rewriting.
 *
 * Seed lessons are deliberately evergreen framings of durable transitions
 * (not version-number trivia) so they stay correct while the tracker grows.
 */

function dynamicLessonBase(
  id: string,
  title: string,
  objectives: string[],
  timeEstimateMin: number,
): Pick<Lesson, 'id' | 'title' | 'objectives' | 'prerequisites' | 'timeEstimateMin'> {
  return { id, title, objectives, prerequisites: [], timeEstimateMin };
}

export const DYNAMIC_CLOUD_COURSE: Course = {
  id: 'dynamic-cloud-big-data',
  title: 'Dynamic Course for Cloud & Big Data Engineering',
  description:
    'Stay current with the rapidly changing world of cloud and big data. Explore new technologies, emerging tools, better alternatives, and major ecosystem changes as they arrive.',
  level: 'Beginner to Advanced',
  totalDuration: 'Ongoing (7 Tracking Lessons)',
  outcomes: [
    'Track new cloud services and judge when each one matters',
    'Evaluate new data tools against the stack you already know',
    'Choose better alternatives with explicit migration trade-offs',
    'Read version changes, API changes, and deprecation notices safely',
    'Follow AI and data infrastructure as it emerges'
  ],
  prerequisites: [
    'Some familiarity with cloud or data concepts helps',
    'Pairs with the stable Cloud & Big Data Engineering course'
  ],
  isDynamic: true,
  lastUpdated: '2026-09',
  modules: [
    {
      id: 'dynamic-cloud-updates',
      title: 'Module 1: Cloud Technology Updates',
      lessons: [
        {
          ...dynamicLessonBase(
            'dynamic-cloud-new-services',
            'How to track new cloud services',
            [
              'Explain where cloud providers announce new services first',
              'Judge whether a new service solves your problem or is marketing',
              'Decide when to adopt, trial, or ignore a launch',
              'Map a new service to the stable concept it builds on'
            ],
            25
          ),
          mode: 'theory',
          dynamic: {
            category: 'emerging',
            technology: 'cloud service launches',
            lastReviewedAt: '2026-09'
          },
          content: {
            explanations: [
              'Cloud providers launch new services constantly, but most launches are variations on a few stable ideas: cheaper compute, managed storage, faster networking, or less operations work. If you know the stable idea underneath, a launch announcement reads in minutes instead of days.',
              'Start with the problem the service claims to remove. A new serverless GPU offering, for example, removes cluster setup for AI workloads. Ask who feels that pain today, and whether that is you.',
              'Trial new services in the smallest possible slice: one workload, tagged resources, a budget alert, and a written teardown step. Launches are cheapest to evaluate early and most expensive to migrate to late.',
              'Ignore a launch when it duplicates something you already run well, when pricing is opaque, or when the migration story is missing. "New" is not a requirement.'
            ],
            demos: [],
            oralQuestions: [
              {
                type: 'recall',
                prompt: 'Name the two cheapest places to learn about a new cloud service launch.'
              },
              {
                type: 'apply',
                prompt: 'A provider launches a managed vector database. Your team runs search on plain Postgres today. What three things do you check before trialling it?'
              }
            ],
            debugging: [],
            exercises: [],
            assessment: {
              questions: [
                {
                  type: 'mcq',
                  prompt: 'A new managed service should first be evaluated by:',
                  choices: ['Migrating production to it', 'Mapping it to the stable problem it solves', 'Ignoring it for a year'],
                  answer: 'Mapping it to the stable problem it solves'
                },
                {
                  type: 'mcq',
                  prompt: 'A safe first trial of a new service always includes:',
                  choices: ['Tagged resources and a teardown step', 'A multi-year commitment', 'Production traffic on day one'],
                  answer: 'Tagged resources and a teardown step'
                }
              ],
              passCriteria: { minCorrect: 1 }
            }
          },
          memoryUpdates: {
            conceptsMastered: [
              'New services are variations on stable ideas',
              'Trial small: one workload, tags, budget alert, teardown'
            ],
            mistakeWatchlist: ['Adopting a launch because it is new']
          },
          nextLesson: 'dynamic-data-new-tools'
        }
      ]
    },
    {
      id: 'dynamic-data-updates',
      title: 'Module 2: Data Engineering Updates',
      lessons: [
        {
          ...dynamicLessonBase(
            'dynamic-data-new-tools',
            'New data processing and orchestration tools',
            [
              'Describe what a new processing engine must beat to earn adoption',
              'Compare orchestration generations: cron, DAG schedulers, modern orchestrators',
              'Explain why open table formats changed the storage layer',
              'Decide when a new tool is worth a migration'
            ],
            30
          ),
          mode: 'light',
          dynamic: {
            category: 'new',
            technology: 'data processing and orchestration tooling',
            lastReviewedAt: '2026-09'
          },
          content: {
            explanations: [
              'Every new data tool competes against the same bar: correct results, reasonable cost, operability at 3am, and a hiring pool. A tool that is only faster on benchmarks but weaker on the other three rarely survives contact with production.',
              'Orchestration moved from cron jobs to DAG schedulers to modern orchestrators with asset awareness and data-aware scheduling. Each generation removed a class of silent failure — missed runs, untested backfills, stale dashboards.',
              'Open table formats let many engines share one set of files with transactions and time travel. That single change turned "which warehouse" from a permanent commitment into a replaceable choice.',
              'Migrate to a new tool when the old one blocks a requirement you actually have — scale, latency, cost, or correctness — not when the new one has nicer branding.'
            ],
            demos: [
              {
                code: `// The adoption bar every new data tool must clear.
// Score 0-2 per dimension; adopt only on a clear total win.
function scoreTool(t) {
  return t.correctness + t.cost + t.operability + t.hiring;
}

const incumbent = { correctness: 2, cost: 1, operability: 2, hiring: 2 };
const newcomer  = { correctness: 2, cost: 2, operability: 1, hiring: 0 };

console.log('incumbent: ' + scoreTool(incumbent));
console.log('newcomer:  ' + scoreTool(newcomer));
console.log('verdict: ' + (scoreTool(newcomer) > scoreTool(incumbent) ? 'migrate' : 'watch and wait'));`,
                explainByLine: false
              }
            ],
            oralQuestions: [
              {
                type: 'apply',
                prompt: 'Your batch pipeline misses its SLA twice a month. A new engine promises 10x speed. What do you check before migrating?'
              }
            ],
            debugging: [],
            exercises: [],
            assessment: {
              questions: [
                {
                  type: 'mcq',
                  prompt: 'Open table formats matter most because they:',
                  choices: ['Make queries faster', 'Turn the warehouse into a replaceable choice', 'Remove the need for SQL'],
                  answer: 'Turn the warehouse into a replaceable choice'
                }
              ],
              passCriteria: { minCorrect: 1 }
            }
          },
          memoryUpdates: {
            conceptsMastered: [
              'Four-dimension adoption bar: correctness, cost, operability, hiring',
              'Open table formats decouple storage from engines'
            ],
            mistakeWatchlist: ['Migrating for benchmark speed alone']
          },
          nextLesson: 'dynamic-ecosystem-shifts'
        }
      ]
    },
    {
      id: 'dynamic-ecosystem-changes',
      title: 'Module 3: Big Data Ecosystem Changes',
      lessons: [
        {
          ...dynamicLessonBase(
            'dynamic-ecosystem-shifts',
            'Reading big ecosystem shifts',
            [
              'Recognize the signs that an ecosystem generation is turning',
              'Explain the lake-to-lakehouse transition as a pattern',
              'Evaluate streaming versus batch for a new workload',
              'Position an emerging architecture on the hype curve honestly'
            ],
            30
          ),
          mode: 'theory',
          dynamic: {
            category: 'emerging',
            technology: 'lakehouse and streaming architectures',
            lastReviewedAt: '2026-09'
          },
          content: {
            explanations: [
              'Ecosystem generations turn when three things line up: the old approach gets expensive at new scale, a standard removes lock-in, and managed options remove the operations burden. Watch for all three before declaring a shift real.',
              'The lake-to-lakehouse move followed the pattern exactly: cheap object storage plus open formats plus managed query engines removed the reason to maintain two separate systems.',
              'Streaming earns its complexity only when decisions must happen in seconds — fraud, live personalization, operational alarms. Everything else is usually cheaper and calmer as scheduled batch with good backfills.',
              'Place emerging tech on a simple curve: experiment, early production with guardrails, boring default. Most announcements never pass stage one, and that is fine.'
            ],
            demos: [],
            oralQuestions: [
              {
                type: 'predict',
                prompt: 'A vendor claims batch processing is dead. Which two workloads from your own experience disprove that?'
              }
            ],
            debugging: [],
            exercises: [],
            assessment: {
              questions: [
                {
                  type: 'mcq',
                  prompt: 'Streaming over batch is justified when:',
                  choices: ['Data volume is large', 'Decisions must happen in seconds', 'The team likes new tools'],
                  answer: 'Decisions must happen in seconds'
                }
              ],
              passCriteria: { minCorrect: 1 }
            }
          },
          memoryUpdates: {
            conceptsMastered: [
              'Three-signal test for a real ecosystem shift',
              'Streaming is for seconds, batch for everything else'
            ],
            mistakeWatchlist: ['Declaring batch dead on vendor claims']
          },
          nextLesson: 'dynamic-ai-infra'
        }
      ]
    },
    {
      id: 'dynamic-ai-data-infra',
      title: 'Module 4: AI + Data Infrastructure',
      lessons: [
        {
          ...dynamicLessonBase(
            'dynamic-ai-infra',
            'Data pipelines for AI workloads',
            [
              'Explain why AI workloads changed data infrastructure priorities',
              'Describe embeddings, vector indexes, and retrieval pipelines',
              'Decide what data is worth grounding a model on',
              'Estimate the cost profile of an AI data pipeline'
            ],
            30
          ),
          mode: 'light',
          dynamic: {
            category: 'new',
            technology: 'vector search and retrieval pipelines',
            introducedAt: '2023-01',
            lastReviewedAt: '2026-09'
          },
          content: {
            explanations: [
              'AI workloads flipped the bottleneck: storage got cheap, but turning company data into trustworthy model answers became the hard part. Retrieval pipelines — chunk, embed, index, retrieve, cite — are now core data engineering.',
              'Embeddings turn text into numbers where similar meanings sit close together. A vector index finds the nearest chunks fast. The pipeline is only as good as the chunking: too big and answers blur, too small and context shatters.',
              'Ground models on data that changes decisions and can be cited: docs, tickets, runbooks. Skip vanity corpora nobody queries.',
              'AI pipelines bill on three axes: embedding compute, index storage and queries, and model tokens per answer. Measure all three per answered question before scaling.'
            ],
            demos: [
              {
                code: `// Retrieval pipeline sketch: chunk -> embed -> top-k -> answer.
// The engineering lives in chunking and evaluation, not the model call.
function chunk(text, size) {
  const words = text.split(' ');
  const out = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' '));
  return out;
}

const docs = ['runbook: restart payments worker on queue lag', 'policy: refunds need manager approval'];
const chunks = docs.flatMap(function (d) { return chunk(d, 6); });
console.log('chunks: ' + chunks.length);
console.log('rule: evaluate retrieval hit-rate before touching the model.');`,
                explainByLine: false
              }
            ],
            oralQuestions: [
              {
                type: 'apply',
                prompt: 'Support answers hallucinate policy details. Sketch the retrieval pipeline fix and what you would measure first.'
              }
            ],
            debugging: [],
            exercises: [],
            assessment: {
              questions: [
                {
                  type: 'mcq',
                  prompt: 'In a retrieval pipeline, answer quality most often breaks at:',
                  choices: ['The model choice', 'Chunking and retrieval evaluation', 'The UI font'],
                  answer: 'Chunking and retrieval evaluation'
                }
              ],
              passCriteria: { minCorrect: 1 }
            }
          },
          memoryUpdates: {
            conceptsMastered: [
              'Chunk, embed, index, retrieve, cite',
              'Measure cost per answered question'
            ],
            mistakeWatchlist: ['Tuning the model before fixing retrieval']
          },
          nextLesson: 'dynamic-better-alternatives'
        }
      ]
    },
    {
      id: 'dynamic-better-alternatives',
      title: 'Module 5: Better Alternatives',
      lessons: [
        {
          ...dynamicLessonBase(
            'dynamic-better-alternatives',
            'Choosing replacements and migrating safely',
            [
              'Compare an incumbent tool with a newer alternative fairly',
              'List the true costs of a migration beyond licenses',
              'Plan a strangler migration with rollback at each step',
              'Decide when NOT to migrate'
            ],
            30
          ),
          mode: 'light',
          dynamic: {
            category: 'alternative',
            technology: 'tool replacement and migration practice',
            lastReviewedAt: '2026-09'
          },
          content: {
            explanations: [
              'Fair comparisons run both tools on YOUR workload with YOUR data and YOUR on-call rotation. Vendor benchmarks compare their best day against your worst day.',
              'Migration costs hide in retraining, rewritten runbooks, dual-running infrastructure, data backfills, and the incidents you will have while learning. Budget all of them.',
              'Strangle the old system: route a slice of traffic, compare outputs, expand the slice, keep rollback one config change away. Big-bang migrations are how outages get promoted to incidents.',
              'Do not migrate a system that is correct, affordable, operable, and boring. Boring is a feature you paid years to earn.'
            ],
            demos: [
              {
                code: `// Strangler migration sketch: shadow, compare, cut over slice by slice.
var trafficSlice = 5; // percent on the new system

function route(request) {
  if (request.id % 100 < trafficSlice) return 'new-system (shadowed, compared)';
  return 'incumbent (source of truth)';
}

console.log(route({ id: 3 }));
console.log(route({ id: 42 }));
console.log('rule: expand the slice only while outputs match.');`,
                explainByLine: false
              }
            ],
            oralQuestions: [
              {
                type: 'apply',
                prompt: 'Leadership wants a full warehouse migration in one quarter. What phased plan do you propose instead?'
              }
            ],
            debugging: [],
            exercises: [],
            assessment: {
              questions: [
                {
                  type: 'mcq',
                  prompt: 'The safest migration pattern is:',
                  choices: ['Big-bang cutover', 'Strangler with per-step rollback', 'Migrating everything at once overnight'],
                  answer: 'Strangler with per-step rollback'
                }
              ],
              passCriteria: { minCorrect: 1 }
            }
          },
          memoryUpdates: {
            conceptsMastered: [
              'Compare on your workload, not vendor benchmarks',
              'Strangler pattern with rollback at each step'
            ],
            mistakeWatchlist: ['Big-bang migrations', 'Ignoring retraining and dual-run costs']
          },
          nextLesson: 'dynamic-whats-new'
        }
      ]
    },
    {
      id: 'dynamic-whats-new',
      title: "Module 6: What's New",
      lessons: [
        {
          ...dynamicLessonBase(
            'dynamic-whats-new',
            'Technologies worth watching right now',
            [
              'Maintain a personal watchlist with explicit exit criteria',
              'Separate signal (production case studies) from noise (launch posts)',
              'Timebox spikes so research never becomes procrastination',
              'Write a one-page adoption brief for anything you recommend'
            ],
            20
          ),
          mode: 'theory',
          dynamic: {
            category: 'emerging',
            technology: 'ecosystem watchlist practice',
            lastReviewedAt: '2026-09'
          },
          content: {
            explanations: [
              'A watchlist is a list with kill criteria: "we adopt X when it has managed hosting, SOC2, and two public postmortems" — otherwise it stays on the list and off your roadmap.',
              'Signal looks like production case studies with numbers, migration guides from real teams, and boring operational detail. Noise looks like launch-day posts with no users.',
              'Timebox every spike: two days, one question, one written verdict. Research without a verdict is entertainment.',
              'An adoption brief fits one page: what it is, what problem it removes, what it replaces, what it costs to try, and what would make you stop.'
            ],
            demos: [],
            oralQuestions: [
              {
                type: 'recall',
                prompt: 'What three kill criteria keep a technology on the watchlist instead of the roadmap?'
              }
            ],
            debugging: [],
            exercises: [],
            assessment: {
              questions: [
                {
                  type: 'mcq',
                  prompt: 'Strong adoption signal is:',
                  choices: ['A launch-day announcement', 'Production case studies with numbers', 'A trending logo'],
                  answer: 'Production case studies with numbers'
                }
              ],
              passCriteria: { minCorrect: 1 }
            }
          },
          memoryUpdates: {
            conceptsMastered: [
              'Watchlist with explicit kill criteria',
              'Timeboxed spikes with written verdicts'
            ],
            mistakeWatchlist: ['Roadmapping from launch posts']
          },
          nextLesson: 'dynamic-whats-changing'
        }
      ]
    },
    {
      id: 'dynamic-whats-changing',
      title: "Module 7: What's Changing",
      lessons: [
        {
          ...dynamicLessonBase(
            'dynamic-whats-changing',
            'Versions, deprecations, and changed best practices',
            [
              'Read a changelog and extract breaking changes in minutes',
              'Handle deprecation notices with a migration runway',
              'Pin, test, and upgrade dependencies on a schedule',
              'Update team practices when the platform changes underneath you'
            ],
            25
          ),
          mode: 'theory',
          dynamic: {
            category: 'deprecated',
            technology: 'upgrade and deprecation practice',
            lastReviewedAt: '2026-09',
            supersedes: []
          },
          content: {
            explanations: [
              'Read changelogs backwards from "breaking" and "removed". Everything else is context. If a release has no migration guide for its breaking changes, treat the upgrade as research, not routine.',
              'A deprecation notice starts a runway, not a fire drill: inventory usage, find the recommended path, migrate the easy majority first, and isolate the hard tail with an explicit owner and date.',
              'Pin versions, upgrade on a schedule you chose, and test the upgrade — not the other way round. Surprise upgrades are how weekends disappear.',
              'When platforms change defaults, your old best practices become tech debt overnight. Re-read your runbooks once a year against current docs.'
            ],
            demos: [],
            oralQuestions: [
              {
                type: 'apply',
                prompt: 'A core library you use announces removal of an API in six months. Lay out your runway plan.'
              }
            ],
            debugging: [],
            exercises: [],
            assessment: {
              questions: [
                {
                  type: 'mcq',
                  prompt: 'The first response to a deprecation notice should be:',
                  choices: ['Upgrade everything immediately', 'Inventory usage and start a migration runway', 'Pin the version forever'],
                  answer: 'Inventory usage and start a migration runway'
                }
              ],
              passCriteria: { minCorrect: 1 }
            }
          },
          memoryUpdates: {
            conceptsMastered: [
              'Changelogs: breaking and removed first',
              'Deprecation runway with owner and date'
            ],
            mistakeWatchlist: ['Surprise upgrades', 'Pinning forever instead of planning']
          }
        }
      ]
    }
  ]
};

/**
 * ML Infrastructure seed script — populates cards.db with 2026 ML/AI system design cards.
 * Covers: feature stores, model serving, vector DBs, RAG, LLM inference at scale,
 * ML pipelines, and ML observability.
 *
 * Safe to re-run: upsertCard uses INSERT OR IGNORE, ensureCardState is idempotent.
 *
 * Usage: npm run seed:ml-infra
 */

import { closeDb, ensureCardState, openDb, upsertCard } from '../lib/db.js';

interface SeedCard {
  id: string;
  deck: 'ml-infra';
  source_path: string;
  title: string;
  body_md: string;
}

const mlInfraCards: SeedCard[] = [
  {
    id: 'ml-infra-001',
    deck: 'ml-infra',
    source_path: 'ml-infra/feature-store/design-feature-store.md',
    title: 'Design a Feature Store',
    body_md: `## Design a Feature Store

Design a feature store that serves pre-computed ML features to both model training pipelines and online inference.

### Requirements
- Store and serve features with low latency for online serving (< 10ms p99)
- Consistent feature values between training and serving (avoid training-serving skew)
- Support time-travel: retrieve feature values as they existed at a given point in time
- Handle 10K+ feature definitions, 10M+ entities (users/items)

### Key Discussion Points

#### Dual Storage Architecture
- **Offline store:** Data lake (S3 + Parquet/Delta Lake) for batch training jobs. Supports point-in-time correct joins.
- **Online store:** Low-latency KV store (Redis, DynamoDB, Cassandra) for serving. Keyed by entity ID.
- **Materialisation jobs:** Spark/Flink pipelines sync offline → online store.

#### Point-in-Time Correctness
- Avoid label leakage: when generating training rows for event at time T, use only feature values that existed before T.
- Store features with timestamps; use \`AS OF\` join semantics.
- Tecton, Feast, and Vertex Feature Store all implement this.

#### Feature Freshness
- **Batch features:** recomputed daily/hourly (e.g., 7-day purchase count).
- **Streaming features:** Flink aggregations pushed to online store in near-real-time (e.g., last 5-minute clicks).
- **On-demand features:** computed at request time from raw inputs (e.g., distance between user and item).

#### Governance & Discovery
- Feature registry: metadata (owner, description, SLAs, dependencies).
- Lineage tracking: which models consume which features.
- Monitoring: data drift detection, null rates, schema drift alerts.`,
  },
  {
    id: 'ml-infra-002',
    deck: 'ml-infra',
    source_path: 'ml-infra/model-serving/design-model-serving.md',
    title: 'Design a Model Serving System',
    body_md: `## Design a Model Serving System

Design an inference serving platform that hosts hundreds of ML models for real-time predictions.

### Requirements
- Sub-100ms p99 latency for online inference
- Auto-scale with traffic (0 to millions of QPS globally)
- A/B testing and shadow deployment support
- Multi-framework support (PyTorch, TensorFlow, XGBoost, custom)

### Key Discussion Points

#### Serving Strategies
- **Online (synchronous):** REST/gRPC endpoint, result returned in the same request. Latency-sensitive (recommendations, fraud).
- **Async batch:** Predictions queued and processed; result stored and polled or pushed (heavy models, bulk scoring).
- **Streaming:** Models applied to event streams via Flink/Kafka (real-time feature + scoring pipeline).

#### Model Server Architecture
- **Model server:** TorchServe, TensorFlow Serving, Triton Inference Server. Handles model loading, versioning, batching, health checks.
- **Sidecar pattern:** Deploy model server as sidecar next to API service (tight coupling) vs. dedicated prediction service (shared resource pool).
- **GPU scheduling:** Pack multiple small models onto one GPU (MIG on A100). Route requests to GPU/CPU tier by model type.

#### Optimisation
- **Dynamic batching:** Accumulate requests in a queue, batch forward pass (Triton supports this natively).
- **Model compression:** Quantisation (INT8/FP16), pruning, distillation to reduce latency and memory.
- **Caching:** Cache predictions for identical inputs (hash of feature vector as key). Works well for categorical embeddings.

#### Deployment & Rollout
- **Canary deployment:** Route 5% of traffic to new model version, observe metrics, gradually ramp.
- **Shadow mode:** Run new model in parallel with no user impact; compare prediction distributions offline.
- **Rollback triggers:** Automated rollback if error rate or latency SLO breached.`,
  },
  {
    id: 'ml-infra-003',
    deck: 'ml-infra',
    source_path: 'ml-infra/vector-db/design-vector-db.md',
    title: 'Design a Vector Database',
    body_md: `## Design a Vector Database

Design a system that stores high-dimensional embeddings and serves approximate nearest-neighbour (ANN) queries at scale.

### Requirements
- Store billions of 768–4096-dimensional vectors
- ANN search: return top-K similar vectors in < 50ms
- Support metadata filtering alongside vector similarity
- Handle frequent upserts (new embeddings as content is indexed)

### Key Discussion Points

#### Indexing Algorithms
| Algorithm | Memory | Build Time | Query Speed | Notes |
|---|---|---|---|---|
| **HNSW** (Hierarchical NSW) | High | Slow | Very fast | Best recall/latency tradeoff; used by Weaviate, Milvus |
| **IVF-PQ** | Low | Moderate | Fast | Product quantisation reduces memory 32×; used by Faiss |
| **ScaNN** | Moderate | Fast | Fast | Google's algorithm; anisotropic quantisation |
| **DiskANN** | Low (SSD) | Slow | Moderate | Billion-scale on SSDs; Microsoft |

#### Sharding & Distribution
- Shard vectors by ID range or by cluster centroids (route queries to relevant shards, merge top-K results).
- Replicate shards for read throughput and availability.
- Coordinator node fans out query to shards, merges results.

#### Filtered Search
- Pre-filter: apply metadata filter first (narrows candidate set), then ANN over reduced set. Risks: if filter is very selective, ANN index is inefficient.
- Post-filter: ANN over full index, apply filter to results. Risk: top-K results may all be filtered out.
- ACORN / Weaviate inverted index hybrid: maintains inverted index for metadata, uses it to prune HNSW traversal.

#### Systems to Know
- **Pinecone** (managed, serverless), **Weaviate** (open-source, graph-enriched), **Milvus** (CNCF, distributed), **Qdrant** (Rust, payload filtering), **pgvector** (PostgreSQL extension, good for < 10M vectors).`,
  },
  {
    id: 'ml-infra-004',
    deck: 'ml-infra',
    source_path: 'ml-infra/rag/design-rag-system.md',
    title: 'Design a Retrieval-Augmented Generation (RAG) System',
    body_md: `## Design a RAG System

Design a production RAG pipeline that retrieves relevant documents from a large corpus and uses an LLM to generate grounded answers.

### Requirements
- Corpus: 100M+ documents (product docs, wiki, code, PDFs)
- Latency: end-to-end answer in < 3 seconds
- Accuracy: cited, faithful answers (minimise hallucination)
- Support document updates (new/edited docs reflected in hours)

### Key Discussion Points

#### Pipeline Components
1. **Ingestion:** Documents → chunker → embedding model → vector store. Parallel batch job; incremental updates via change-data-capture.
2. **Retrieval:** User query → embedding → ANN search → top-K chunks. Optionally rerank with a cross-encoder (slower but more accurate).
3. **Generation:** Retrieved chunks + query injected into LLM prompt → streamed response with citations.

#### Chunking Strategies
- Fixed-size with overlap (simple, misses semantic boundaries).
- Sentence/paragraph-aware (spaCy / NLTK; respects natural boundaries).
- Semantic chunking (embed consecutive sentences, split where cosine similarity drops sharply).
- Hierarchical: store document → section → paragraph; retrieve at granular level, expand for context.

#### Retrieval Quality
- **Hybrid search:** Sparse (BM25/TF-IDF keyword) + Dense (embedding) retrieval, fused with Reciprocal Rank Fusion (RRF).
- **Query rewriting:** LLM expands query with synonyms / hypothetical answer (HyDE).
- **Reranking:** Cross-encoder model (Cohere Rerank, BGE-Reranker) to reorder top-K before generation.

#### Evaluation
- **Faithfulness:** Is the answer grounded in retrieved chunks? (RAGAS)
- **Answer relevance:** Does the answer address the question?
- **Context recall:** Were the relevant documents retrieved?
- Maintain a golden Q&A eval set; run regression on each pipeline change.`,
  },
  {
    id: 'ml-infra-005',
    deck: 'ml-infra',
    source_path: 'ml-infra/llm-infra/design-llm-inference-scale.md',
    title: 'Design LLM Inference at Scale',
    body_md: `## Design LLM Inference at Scale

Design the serving infrastructure for a large language model (e.g., 70B parameter) serving millions of concurrent users.

### Requirements
- Throughput: 10K tokens/sec per instance
- Latency: Time-to-first-token (TTFT) < 500ms; inter-token latency < 50ms
- Cost efficiency: maximise GPU utilisation
- Support streaming responses (SSE / WebSocket)

### Key Discussion Points

#### GPU Memory Constraints
- 70B model in FP16 = 140 GB VRAM → requires at least 2× A100 80 GB or 1× H100 80 GB with quantisation (INT4 → ~35 GB).
- Tensor parallelism: split model weight matrices across GPUs (Megatron-LM style). Requires NVLink for low-latency inter-GPU communication.
- Pipeline parallelism: split transformer layers across GPUs. Less communication overhead but bubbles in the pipeline.

#### KV-Cache Management
- The KV cache grows with sequence length: batch_size × seq_len × layers × head_dim × 2 × dtype_bytes.
- **PagedAttention (vLLM):** Manages KV cache in fixed-size pages (like OS virtual memory). Enables higher batch sizes and near-zero fragmentation. Industry standard.
- **Prefix caching:** Cache KV states for shared system prompts across requests (reduces TTFT for common prefixes).

#### Continuous Batching
- Unlike static batching (wait for fixed batch), continuous batching (aka iteration-level scheduling) allows new requests to join in-flight batches, drastically improving GPU utilisation.
- vLLM, TGI (HuggingFace), and TensorRT-LLM all implement this.

#### Quantisation & Efficiency
- **AWQ / GPTQ:** 4-bit weight quantisation with minimal accuracy loss. 2–4× memory reduction.
- **FlashAttention-2/3:** Fused attention kernel — O(n) memory vs. O(n²), 2–4× faster attention.
- **Speculative decoding:** Draft model generates K tokens speculatively; large model verifies in parallel. Reduces latency for simple completions.

#### Autoscaling
- Scale by queue depth (tokens waiting / GPU throughput). Spin up replicas in < 60s using spot instances with model pre-loaded from object store.`,
  },
  {
    id: 'ml-infra-006',
    deck: 'ml-infra',
    source_path: 'ml-infra/ml-pipeline/design-ml-training-pipeline.md',
    title: 'Design an ML Training Pipeline',
    body_md: `## Design an ML Training Pipeline

Design a scalable ML training platform supporting continuous retraining of production models across hundreds of experiments.

### Requirements
- Trigger retraining on data drift, schedule, or on-demand
- Reproducible: same code + data + config → same model
- Track experiments (metrics, hyperparameters, artifacts)
- Serve new model automatically if it passes quality gates

### Key Discussion Points

#### Pipeline Stages
1. **Data validation:** Schema checks, distribution drift detection (Evidently, Great Expectations). Fail fast before compute spend.
2. **Feature engineering:** Spark / Beam batch transforms. Output stored in data lake, registered in feature store.
3. **Training:** Distributed training (DDP for PyTorch, Horovod) on GPU cluster. Checkpoint to object store periodically.
4. **Evaluation:** Held-out test set metrics, slice analysis (fairness across demographic groups), comparison to production champion model.
5. **Registration:** Push model artifact + metadata to model registry (MLflow, W&B Model Registry). Tag with version, accuracy, training data lineage.
6. **Deployment:** Automated canary rollout if eval passes threshold; otherwise human approval gate.

#### Orchestration
- **Airflow / Prefect / Metaflow:** DAG-based workflow orchestration. Retries, dependency management, alerting.
- **Kubeflow Pipelines:** Kubernetes-native; each step is a container. Good for GPU workloads.
- **Vertex AI Pipelines / SageMaker Pipelines:** Managed options with built-in ML metadata tracking.

#### Reproducibility
- Pin data snapshot (S3 path + version), code commit hash, dependency versions in experiment metadata.
- Container images for training jobs → exact environment reproducibility.
- Feature store point-in-time snapshots for training datasets.

#### Data Versioning
- DVC (Git for data): tracks dataset versions in Git, stores large files in remote (S3/GCS).
- Delta Lake / Iceberg: ACID tables with time-travel — query data as-of any past timestamp.`,
  },
  {
    id: 'ml-infra-007',
    deck: 'ml-infra',
    source_path: 'ml-infra/ml-monitoring/design-ml-monitoring.md',
    title: 'Design ML Model Monitoring & Observability',
    body_md: `## Design ML Model Monitoring & Observability

Design a monitoring system that detects degradation in production ML models and triggers alerting/retraining.

### Requirements
- Detect data drift, concept drift, and prediction drift in real-time
- Monitor model performance when ground truth labels are available (with delay)
- Alert on-call when SLOs breach, auto-trigger retraining for known drift patterns
- Dashboards for model owners across 200+ production models

### Key Discussion Points

#### Types of Drift
- **Data/input drift:** Distribution of input features shifts (e.g., users in new geography with different behaviour). Detected without labels.
- **Concept drift:** The true relationship between features and labels changes (e.g., fraud patterns evolve). Requires label feedback.
- **Prediction drift:** Output distribution shifts (e.g., model suddenly predicting higher churn). Leading indicator of model degradation.
- **Label drift:** Distribution of actual outcomes shifts independently (e.g., seasonality).

#### Drift Detection Methods
- **Statistical tests:** KS test (continuous), Chi-squared (categorical), Population Stability Index (PSI).
- **Model-based:** Train a binary classifier to distinguish production data from reference data (training distribution). AUC > 0.7 → significant drift.
- **Embedding distance:** For NLP/image models, track distribution of embeddings (MMD, Wasserstein distance).

#### Metrics to Track
- **Technical:** Latency, error rate, GPU utilisation, batch size.
- **Statistical:** Feature means/std, null rates, PSI per feature, output distribution.
- **Business:** Downstream KPI correlated with model output (CTR, conversion rate, fraud caught).

#### Feedback Loop
- Log prediction + inputs for every request (sampling for high-volume). Store in data lake.
- Join with delayed labels (e.g., T+7 day label for churn). Compute performance on labelled cohort.
- Alert if accuracy/AUC drops below threshold → trigger retraining pipeline.

#### Tooling
- **Evidently AI:** Open-source drift + performance reports.
- **WhyLabs:** SaaS monitoring with automatic profiling.
- **Arize / Fiddler:** Enterprise ML observability, explainability.`,
  },
  {
    id: 'ml-infra-008',
    deck: 'ml-infra',
    source_path: 'ml-infra/llm-infra/design-llm-gateway.md',
    title: 'Design an LLM Gateway / API Proxy',
    body_md: `## Design an LLM Gateway / API Proxy

Design a centralised gateway that proxies all LLM API calls across an organisation, providing routing, caching, rate limiting, and cost control.

### Requirements
- Route requests to the best model based on task type, cost, and latency budget
- Semantic caching: return cached completions for semantically similar queries
- Per-team rate limiting and cost attribution
- Observability: log every prompt/response with token counts, model, latency, cost

### Key Discussion Points

#### Routing Logic
- Route by declared intent (tag in request metadata) or automatic classifier on the prompt.
- Cascade: try cheap/fast model first (Haiku); if confidence low, escalate to larger model (Sonnet/Opus).
- Latency budget routing: if client specifies \`max_latency_ms\`, route to fastest available model that fits.

#### Semantic Cache
- Embed each prompt, query vector store for similar past prompts (cosine similarity > 0.97 = cache hit).
- Cache key: embedding hash + model + system prompt hash + temperature (for deterministic calls only).
- TTL based on content type: factual answers cache longer (24h), code generation shorter (1h).
- Hit rate for customer support / FAQ-style queries can reach 30–50%.

#### Rate Limiting & Cost Control
- Token bucket per (team, model) pair. Track both request rate and token rate (input + output tokens).
- Soft limits: warn when 80% consumed. Hard limits: block at 100%, return 429 with \`Retry-After\`.
- Budget alerts: notify FinOps team when monthly spend forecast exceeds budget.

#### Observability
- Log structured record: \`{request_id, team, model, prompt_tokens, completion_tokens, latency_ms, cost_usd, cached}\`.
- Stream logs to data warehouse for cost analytics and model comparison.
- Track per-model error rates (provider outages) for automatic failover.`,
  },
  {
    id: 'ml-infra-009',
    deck: 'ml-infra',
    source_path: 'ml-infra/vector-db/design-embedding-pipeline.md',
    title: 'Design an Embedding Pipeline',
    body_md: `## Design an Embedding Pipeline

Design a system that converts a large, frequently updated corpus into embeddings and keeps them in sync.

### Requirements
- Corpus: 500M documents (product catalogue, wiki articles, support tickets)
- Full re-embed corpus in < 24 hours using batch GPU jobs
- Incremental updates: new/edited/deleted documents reflected in < 5 minutes
- Multiple embedding models (multilingual, code, image); each corpus may use different model

### Key Discussion Points

#### Batch Ingestion
- Partition documents across GPU workers (e.g., 100 A10G GPUs × 5M docs each).
- Use sentence-transformers with fp16 + dynamic batching (batch size 256–1024 depending on doc length).
- Throughput: ~20K docs/sec per GPU → 500M docs in ~7h with 100 GPUs.
- Output: (doc_id, vector) pairs written to Parquet on S3; bulk-loaded into vector store.

#### Incremental Updates (Change Data Capture)
- Listen to change stream from source DB (Debezium → Kafka).
- Embedding worker consumes events: on INSERT/UPDATE → embed → upsert to vector store; on DELETE → remove by doc_id.
- Lag monitoring: alert if consumer lag > 2min (SLO breach risk).

#### Model Versioning
- Each embedding model version produces incompatible vector spaces.
- **Zero-downtime migration:** Run new model in shadow; once full corpus re-embedded, do an atomic swap of the vector store index; then deprecate old.
- Store model version alongside each embedding for auditability.

#### Quality & Validation
- Intrinsic eval: measure retrieval recall@K on a golden query set before promoting new model.
- Canary: route 5% of search traffic to new index; compare MRR vs. current.`,
  },
  {
    id: 'ml-infra-010',
    deck: 'ml-infra',
    source_path: 'ml-infra/ml-pipeline/design-data-flywheel.md',
    title: 'Design a Data Flywheel for Continuous Model Improvement',
    body_md: `## Design a Data Flywheel

Design a self-improving ML system where production traffic generates labelled training data, enabling continuous model improvement.

### Requirements
- Capture implicit signals (clicks, purchases, dwell time) and explicit feedback (thumbs up/down)
- Construct training examples with low-noise labels at scale
- Trigger retraining when sufficient new signal has accumulated
- A/B test new models to validate improvement before full rollout

### Key Discussion Points

#### Signal Collection
- **Implicit:** Log user actions with context (what was shown, user features, timestamp). Store in event stream (Kafka) → data lake.
- **Explicit:** In-product rating UI (stars, thumbs). Lower volume but higher quality signal.
- **Correction data:** User edits an AI-generated response → gold-label training pair.

#### Label Construction
- **Delayed label join:** Match prediction at time T with outcome observed at T+Δ (e.g., click within 30 min of recommendation → positive).
- **Propensity weighting:** Correct for position bias (items shown first get more clicks). Inverse propensity scoring (IPS).
- **Label denoising:** Aggregate multiple weak signals (clicks, dwell, conversions) into a single relevance score via EM or a small model.

#### Triggering Retraining
- Data trigger: rerun when N new labelled examples accumulated (e.g., 100K fresh pairs).
- Drift trigger: rerun when drift detector fires (distribution shift in recent data).
- Schedule trigger: daily/weekly retraining as baseline.
- Champion-challenger: new model must beat champion by Δ% on held-out test set + online A/B test before promotion.

#### Pitfalls
- **Feedback loops:** Model's own predictions influence labels (e.g., only shown items get clicked). Use exploration (epsilon-greedy, Thompson sampling) to collect counterfactual data.
- **Label lag:** Ground truth not available immediately. Design system to handle asynchronous label arrival.`,
  },
  {
    id: 'ml-infra-011',
    deck: 'ml-infra',
    source_path: 'ml-infra/model-serving/design-multi-model-serving.md',
    title: 'Multi-Model Serving: Mixture of Experts & Ensembles',
    body_md: `## Design Multi-Model / Ensemble Serving

Design a serving system that dynamically routes requests across multiple models or combines predictions from an ensemble.

### Requirements
- Support MoE (Mixture of Experts) routing, ensemble averaging, and stacking
- Latency budget: ensemble inference < 200ms total
- Models may have different latency and cost profiles
- Enable per-request routing decisions based on input features

### Key Discussion Points

#### Routing Strategies
- **Hard routing (MoE-style):** A lightweight gating model classifies input → routes to one of N expert models. Expert models are specialised (e.g., code-specific, finance-specific LLM).
- **Soft routing:** Weighted combination of all expert outputs (expensive; all experts must run).
- **Cascade / early exit:** Run cheap model first; route to expensive model only if confidence < threshold (avoids unnecessary cost).

#### Ensemble Methods
- **Averaging:** Average predicted probabilities from N independently trained models. Reduces variance. Requires all models run in parallel.
- **Stacking:** Train a meta-learner on out-of-fold predictions of base models. Offline training step; serving just runs base models + meta-learner.
- **Boosting at serve time:** Rarely done; ensemble is typically pre-compiled into a single model.

#### Parallel Execution
- Fire all parallel model calls simultaneously (Promise.all / gRPC fan-out).
- Set aggressive per-model timeouts; skip failed/slow models and note in response metadata.
- Budget: if each model takes 60ms and all run in parallel, ensemble latency ≈ max(models) not sum.

#### Cost Management
- Track per-model cost per request. Router should learn to avoid expensive experts for easy inputs.
- Log expert usage distribution to detect routing collapse (all requests going to one expert).`,
  },
  {
    id: 'ml-infra-012',
    deck: 'ml-infra',
    source_path: 'ml-infra/llm-infra/design-llm-fine-tuning-infra.md',
    title: 'Design LLM Fine-Tuning Infrastructure',
    body_md: `## Design LLM Fine-Tuning Infrastructure

Design the infrastructure for fine-tuning large language models on proprietary data, enabling safe, reproducible, cost-effective customisation.

### Requirements
- Fine-tune 7B–70B parameter models on custom datasets (10K–10M examples)
- Full fine-tune and parameter-efficient methods (LoRA, QLoRA)
- Track experiments, compare runs, manage trained adapters
- Data privacy: fine-tuning data must never leave secure environment

### Key Discussion Points

#### Parameter-Efficient Fine-Tuning (PEFT)
- **LoRA (Low-Rank Adaptation):** Freeze base model weights; inject small trainable rank-decomposition matrices (r=8–64) into attention layers. Adapter size: ~10–100 MB vs. full model (140 GB for 70B).
- **QLoRA:** LoRA + 4-bit quantised base model. Enables fine-tuning 65B model on a single A100 80 GB.
- **Prompt tuning / prefix tuning:** Prepend learnable soft tokens. Fewer parameters but lower task performance.
- **Full fine-tune:** Best accuracy but requires full model gradient + optimizer states (3× model size in memory).

#### Distributed Training Setup
- **Single GPU (QLoRA):** 7B model fits on 1× A100 40 GB.
- **Multi-GPU (DDP):** Replicate model on each GPU, sync gradients each step. Efficient for full fine-tune of smaller models.
- **FSDP / DeepSpeed ZeRO:** Shard model weights and optimizer states across GPUs. Enables fine-tuning 70B on 8× A100s.

#### Dataset Management
- Store training data in object store (S3). Version datasets (DVC or Delta Lake).
- Data preprocessing: tokenisation, formatting (instruction template), deduplication, PII scrubbing before training.
- Train/val/test split; hold out test set for final eval only.

#### Experiment Tracking
- Log per-step loss, gradient norm, learning rate, GPU memory, samples/sec.
- Compare runs: W&B or MLflow dashboards. Hyperparameter sweeps (Optuna / Ray Tune).
- Save checkpoints every N steps. Final adapter pushed to model registry with eval scores.`,
  },
  {
    id: 'ml-infra-013',
    deck: 'ml-infra',
    source_path: 'ml-infra/ml-pipeline/design-ab-testing-ml.md',
    title: 'A/B Testing & Experimentation for ML Models',
    body_md: `## Design an ML Experimentation Platform

Design an experimentation platform for safely testing new ML models in production with statistically rigorous evaluation.

### Requirements
- Run hundreds of concurrent A/B experiments across multiple surfaces
- Statistical significance detection with configurable power and alpha
- Support interleaving experiments (multiple models on same user simultaneously)
- Prevent novelty effects and carryover between experiments

### Key Discussion Points

#### Experiment Assignment
- **User-level bucketing:** Hash(user_id + experiment_id) % 100 → stable assignment. Same user always sees same variant.
- **Session-level:** Re-randomise each session. Good for short experiments but can confuse users.
- **Cluster-level:** For experiments with network effects (social features), assign groups of connected users.

#### Statistical Methods
- **Frequentist t-test / z-test:** Compute p-value against H0. Collect pre-specified sample size for desired power. Problem: temptation to peek early (inflates Type I error).
- **Sequential testing (mSPRT):** Allows early stopping while controlling error rates. Preferred for online experiments.
- **Bayesian:** Compute P(variant > control). Flexible; allows prior knowledge. Common in recommendation systems.

#### Metric Selection
- **Primary metric (OEC - Overall Evaluation Criterion):** The single north-star metric to optimise (e.g., 7-day retention, revenue/user).
- **Guardrail metrics:** Must not worsen (latency, error rate, user satisfaction). Experiment auto-stops if guardrail breached.
- **Proxy metrics:** Faster-to-collect leading indicators correlated with long-term goals.

#### Novelty & Carryover
- **Novelty effect:** New feature gets extra engagement just because it's new. Mitigate by running experiments longer (2–4 weeks).
- **Carryover / contamination:** Users in holdout are affected by changes seen by treatment (e.g., recommendation systems). Use switchback experiments or global holdouts.`,
  },
  {
    id: 'ml-infra-014',
    deck: 'ml-infra',
    source_path: 'ml-infra/vector-db/design-semantic-search.md',
    title: 'Design a Semantic Search System',
    body_md: `## Design a Semantic Search System

Design a search system that understands intent beyond keyword matching, supporting a product catalogue of 50M items with 100K QPS.

### Requirements
- Understand semantic intent (synonyms, paraphrases, concept similarity)
- Combine lexical (keyword) and semantic (embedding) signals
- Return results in < 100ms p99
- Support personalisation (user context influences ranking)

### Key Discussion Points

#### Query Processing
1. **Query analysis:** Spell correction, query classification (navigational/informational/transactional), entity extraction.
2. **Query expansion:** Synonyms, related terms via WordNet or learned embeddings. Hypothetical Document Embeddings (HyDE) for RAG-style search.
3. **Embedding:** Encode query with same model used to embed documents (e.g., \`text-embedding-3-large\`, \`e5-large\`).

#### Retrieval Layer
- **Lexical (BM25):** Elasticsearch/OpenSearch. Fast, interpretable, handles rare terms well.
- **Semantic (ANN):** Vector DB (Pinecone, Qdrant, Weaviate). Handles synonyms and intent.
- **Hybrid fusion:** Reciprocal Rank Fusion (RRF) or learned weighted combination. Consistently outperforms either alone.

#### Ranking
- **L1 (retrieval):** Fast ANN + BM25; recall hundreds of candidates.
- **L2 (reranking):** Cross-encoder model (scores each query-doc pair jointly). Slower but more accurate. Run on top-50–200 candidates.
- **L3 (personalisation):** Incorporate user features, history, context signals. Blend into final score.

#### Cold Start & Freshness
- New items indexed in < 1 min via streaming pipeline (Kafka → embed → upsert to vector store).
- Boosting rules for new/promoted items to compensate for lack of engagement signals.`,
  },
  {
    id: 'ml-infra-015',
    deck: 'ml-infra',
    source_path: 'ml-infra/llm-infra/design-prompt-management.md',
    title: 'Design a Prompt Management System',
    body_md: `## Design a Prompt Management System

Design a system for versioning, testing, deploying, and monitoring prompts used by LLM-powered features across a product.

### Requirements
- Dozens of teams, hundreds of prompts in production
- Version control: roll back prompts without code deployment
- Eval suite: automated regression testing for each prompt change
- Track cost and quality metrics per prompt version in production

### Key Discussion Points

#### Prompt Registry
- Store prompts as versioned artifacts (Git or database-backed). Each prompt has: template text, model, temperature, max_tokens, owner, description.
- Semantic versioning (1.0.0). Breaking changes (changed output format) bump major version.
- Promotion workflow: draft → reviewed → staging → production. Requires eval pass to promote.

#### Prompt Templating
- Variables injected at runtime (Jinja2-style, or Mustache). Separate static prompt text from dynamic context.
- Few-shot examples stored separately, selected dynamically based on similarity to input (dynamic few-shot).
- System prompts vs. user-turn templates stored and versioned independently.

#### Automated Evaluation
- **LLM-as-judge:** GPT-4 / Claude scores output quality on rubric (1–5). Fast, scalable, but biased toward same model family.
- **Deterministic checks:** Output format validation (JSON schema), required phrase inclusion, forbidden phrase exclusion.
- **Golden test set:** Human-curated (input, expected output) pairs. Regression alerts if score drops > Δ%.
- Run evals in CI/CD pipeline; block promotion on regression.

#### Production Monitoring
- Log (prompt_id, prompt_version, input_tokens, output_tokens, latency, cost) per call.
- Track output distribution: length, format compliance, refusal rate.
- Cost attribution by prompt and team. Alert on unexpected cost spikes (prompt change caused 3× token usage).`,
  },
];

async function main() {
  const db = openDb();
  const now = Date.now();

  console.log('Seeding ML Infrastructure cards...\n');

  let insertedCards = 0;
  let skippedCards = 0;

  for (const card of mlInfraCards) {
    const inserted = upsertCard(db, {
      id: card.id,
      deck: card.deck,
      source_path: card.source_path,
      title: card.title,
      body_md: card.body_md,
      created_at: now,
    });

    if (inserted) {
      insertedCards++;
      console.log(`  [+] ml-infra    ${card.id}  ${card.title}`);
    } else {
      skippedCards++;
      console.log(`  [~] ml-infra    ${card.id}  ${card.title} (already exists)`);
    }

    ensureCardState(db, card.id, now);
  }

  const countCards = (db.prepare('SELECT COUNT(*) as n FROM cards').get() as { n: number }).n;
  const countMlInfra = (db.prepare("SELECT COUNT(*) as n FROM cards WHERE deck = 'ml-infra'").get() as { n: number }).n;
  const countDue = (db.prepare('SELECT COUNT(*) as n FROM card_state WHERE due_at <= ?').get(now) as { n: number }).n;

  console.log('\n--- ML Infra Seed complete ---');
  console.log(`  Inserted this run   : ${insertedCards}`);
  console.log(`  Already existed     : ${skippedCards}`);
  console.log(`  Total cards in DB   : ${countCards}`);
  console.log(`  ML-Infra cards      : ${countMlInfra}`);
  console.log(`  Due now             : ${countDue}`);

  closeDb();
}

main().catch((err) => {
  console.error('ML Infra seed failed:', err);
  process.exit(1);
});

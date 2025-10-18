flowchart TD
    User --> Orchestrator
    Orchestrator --> Filter
    Orchestrator --> Classifier
    Orchestrator --> FAQ[FAQ Search (Gemma)]
    Orchestrator --> LLM[LLM (LLAMA-3.2)]
    Orchestrator --> Logger
    FAQ --> KnowledgeBase
    LLM --> Operator

// Enhanced mock data with abstracts and speaker bios

const photo = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff&size=128&bold=true`

export const mockProducers: Record<string, { name: string; name_zh: string; bio: string; bio_zh: string; photo_url: string; title: string; title_zh: string }> = {
  "Room A": {
    name: "德哥 (Digoal)",
    name_zh: "德哥 (Digoal)",
    title: "PostgreSQL ACE Director",
    title_zh: "PostgreSQL ACE 总监",
    bio: "Zhou Digoal is a PostgreSQL ACE Director and one of the most influential PostgreSQL evangelists in China. He has authored thousands of technical articles and is the founder of the PostgreSQL community in China.",
    bio_zh: "周德哥 (Digoal)，PostgreSQL ACE 总监，中国最具影响力的 PostgreSQL 布道者之一。撰写了数千篇技术文章，是中国 PostgreSQL 社区的奠基人。",
    photo_url: photo("Digoal"),
  },
  "Room B": {
    name: "Zhou Fei",
    name_zh: "周飞",
    title: "Senior Database Architect",
    title_zh: "资深数据库架构师",
    bio: "Zhou Fei is a senior database architect with 12+ years of PostgreSQL experience. He specializes in high availability architectures and performance optimization for large-scale deployments.",
    bio_zh: "周飞，资深数据库架构师，拥有12年以上 PostgreSQL 经验。擅长大规模部署的高可用架构和性能优化。",
    photo_url: photo("Zhou Fei"),
  },
  "Room C": {
    name: "Li Hongda",
    name_zh: "李宏达",
    title: "Open Source Community Lead",
    title_zh: "开源社区负责人",
    bio: "Li Hongda leads open source community initiatives, bridging PostgreSQL ecosystem partners and developers. He has organized 50+ community events and contributed to multiple PG extensions.",
    bio_zh: "李宏达，开源社区负责人，连接 PostgreSQL 生态合作伙伴和开发者。组织过50多场社区活动，为多个 PG 扩展做出贡献。",
    photo_url: photo("Li Hongda"),
  },
  "Room D": {
    name: "Wang Xiaowei",
    name_zh: "王晓伟",
    title: "Enterprise Solutions Director",
    title_zh: "企业解决方案总监",
    bio: "Wang Xiaowei has 15 years of experience helping enterprises adopt PostgreSQL. He has led migration projects for 20+ Fortune 500 companies from Oracle to PostgreSQL.",
    bio_zh: "王晓伟，拥有15年帮助企业采用 PostgreSQL 的经验。领导了20多家财富500强公司从 Oracle 迁移到 PostgreSQL 的项目。",
    photo_url: photo("Wang Xiaowei"),
  },
}

export const mockSlots = [
  // ==========================================
  // DAY 1 MORNING — 主论坛 April 14
  // ==========================================
  { id: "d1-1", date: "2027-04-14", start_time: "08:30", end_time: "09:00", label: "Registration & Welcome", label_zh: "签到 & 入场", type: "opening", room: "Main Hall", sort_order: 1, session_id: null, sessions: null },
  { id: "d1-2", date: "2027-04-14", start_time: "09:00", end_time: "09:15", label: "Opening Ceremony", label_zh: "开幕致辞", type: "opening", room: "Main Hall", sort_order: 2, session_id: null, sessions: null },
  { id: "d1-3", date: "2027-04-14", start_time: "09:15", end_time: "10:00", label: "", label_zh: "", type: "keynote", room: "Main Hall", sort_order: 3, session_id: "s-k1",
    sessions: { id: "s-k1", title: "PostgreSQL 18: The Road Ahead", title_zh: "PostgreSQL 18：未来之路", abstract: "PostgreSQL 18 introduces major improvements in query performance, logical replication, and developer experience. This keynote covers the highlights of the new release and the roadmap for future development, including native sharding, improved JSON support, and AI-assisted query optimization.", abstract_zh: "PostgreSQL 18 在查询性能、逻辑复制和开发者体验方面引入了重大改进。本次主题演讲将介绍新版本的亮点和未来发展路线图，包括原生分片、改进的 JSON 支持以及 AI 辅助查询优化。", duration: 45, type: "keynote",
      profiles: { full_name: "Zhang Wei", company: "IvorySQL", bio: "Core contributor to PostgreSQL and founder of the IvorySQL project. 15+ years in database kernel development.", bio_zh: "PostgreSQL 核心贡献者，IvorySQL 项目创始人。15年以上数据库内核开发经验。", photo_url: photo("Zhang Wei") } } },
  { id: "d1-4", date: "2027-04-14", start_time: "10:00", end_time: "10:45", label: "", label_zh: "", type: "keynote", room: "Main Hall", sort_order: 4, session_id: "s-k2",
    sessions: { id: "s-k2", title: "Building a Global Open Source Database Ecosystem", title_zh: "构建全球开源数据库生态", abstract: "Open source databases have transformed how organizations build and scale applications. This talk explores the key ingredients of a thriving open source ecosystem: community governance, contributor programs, commercial backing, and cross-project collaboration.", abstract_zh: "开源数据库已经改变了组织构建和扩展应用的方式。本演讲将探讨繁荣的开源生态系统的关键要素：社区治理、贡献者计划、商业支持和跨项目协作。", duration: 45, type: "keynote",
      profiles: { full_name: "Sarah Chen", company: "Supabase", bio: "Developer advocate at Supabase, previously at Google Cloud. Passionate about making databases accessible to all developers.", bio_zh: "Supabase 开发者布道师，曾在 Google Cloud 工作。热衷于让数据库对所有开发者触手可及。", photo_url: photo("Sarah Chen") } } },
  { id: "d1-5", date: "2027-04-14", start_time: "10:45", end_time: "11:15", label: "Coffee Break & Networking", label_zh: "茶歇 & 交流", type: "break", room: null, sort_order: 5, session_id: null, sessions: null },
  { id: "d1-6", date: "2027-04-14", start_time: "11:15", end_time: "12:00", label: "", label_zh: "", type: "keynote", room: "Main Hall", sort_order: 6, session_id: "s-k3",
    sessions: { id: "s-k3", title: "AI Meets PostgreSQL: The Next Frontier", title_zh: "AI 与 PostgreSQL：下一个前沿", abstract: "From pgvector to AI-assisted query planning, PostgreSQL is becoming a key infrastructure for AI workloads. This talk surveys the landscape of AI + PostgreSQL, including vector search, model serving, and using LLMs for database administration.", abstract_zh: "从 pgvector 到 AI 辅助查询计划，PostgreSQL 正成为 AI 工作负载的关键基础设施。本演讲将概览 AI + PostgreSQL 的全景，包括向量搜索、模型服务和使用 LLM 进行数据库管理。", duration: 45, type: "keynote",
      profiles: { full_name: "Wang Lei", company: "HighGo Software", bio: "CTO at HighGo Software, focusing on PostgreSQL enterprise solutions and Oracle-to-PostgreSQL migration.", bio_zh: "HighGo Software CTO，专注 PostgreSQL 企业级解决方案及 Oracle 到 PostgreSQL 迁移。", photo_url: photo("Wang Lei") } } },
  { id: "d1-7", date: "2027-04-14", start_time: "12:00", end_time: "13:30", label: "Lunch Break", label_zh: "午餐", type: "break", room: null, sort_order: 7, session_id: null, sessions: null },

  // ==========================================
  // DAY 1 AFTERNOON — 分论坛 (4 parallel rooms)
  // ==========================================
  // — Room A: 数据库内核 —
  { id: "d1p-1a", date: "2027-04-14", start_time: "13:30", end_time: "14:15", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 10, session_id: "s-p1",
    sessions: { id: "s-p1", title: "Deep Dive into PostgreSQL Query Optimizer", title_zh: "PostgreSQL 查询优化器深度剖析", abstract: "Understanding the query optimizer is essential for writing performant SQL. We dive into the internals of cost estimation, join ordering, statistics management, and how to debug optimizer decisions using EXPLAIN.", abstract_zh: "理解查询优化器对于编写高性能 SQL 至关重要。我们将深入成本估算、连接排序、统计信息管理的内部机制，以及如何使用 EXPLAIN 调试优化器决策。", duration: 45, type: "talk",
      profiles: { full_name: "Liu Ming", company: "Alibaba Cloud", bio: "Senior database engineer specializing in PostgreSQL query optimization and performance tuning.", bio_zh: "高级数据库工程师，专攻 PostgreSQL 查询优化和性能调优。", photo_url: photo("Liu Ming") } } },
  { id: "d1p-2a", date: "2027-04-14", start_time: "14:30", end_time: "15:15", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 11, session_id: "s-p2",
    sessions: { id: "s-p2", title: "Custom WAL Resource Managers in PostgreSQL", title_zh: "PostgreSQL 自定义 WAL 资源管理器", abstract: "Custom WAL Resource Managers enable extensions to integrate with PostgreSQL's write-ahead logging system. This talk covers the API, use cases for distributed systems, and lessons from building a custom WAL RM.", abstract_zh: "自定义 WAL 资源管理器使扩展可以与 PostgreSQL 的预写日志系统集成。本演讲涵盖 API、分布式系统的用例以及构建自定义 WAL RM 的经验教训。", duration: 45, type: "talk",
      profiles: { full_name: "Alex Johnson", company: "GitLab", bio: "Staff database engineer at GitLab, maintaining one of the world's largest PostgreSQL fleets.", bio_zh: "GitLab 高级数据库工程师，维护全球最大的 PostgreSQL 集群之一。", photo_url: photo("Alex Johnson") } } },
  { id: "d1p-3a", date: "2027-04-14", start_time: "15:30", end_time: "16:15", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 12, session_id: null, sessions: null },
  { id: "d1p-4a", date: "2027-04-14", start_time: "16:30", end_time: "17:15", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 13, session_id: null, sessions: null },

  // — Room B: 性能与运维 —
  { id: "d1p-1b", date: "2027-04-14", start_time: "13:30", end_time: "14:15", label: "", label_zh: "", type: "session", room: "Room B — 性能与运维", sort_order: 20, session_id: "s-p5",
    sessions: { id: "s-p5", title: "Zero-Downtime PostgreSQL Upgrades at Scale", title_zh: "大规模 PostgreSQL 零停机升级", abstract: "How to perform major version upgrades on hundreds of PostgreSQL instances without interrupting service. Covers logical replication cutover strategies, automated testing pipelines, and rollback plans.", abstract_zh: "如何在不中断服务的情况下对数百个 PostgreSQL 实例进行大版本升级。涵盖逻辑复制切换策略、自动化测试管道和回滚方案。", duration: 45, type: "talk",
      profiles: { full_name: "Maria Santos", company: "AWS", bio: "Principal database engineer at AWS RDS, focusing on managed PostgreSQL services and fleet management.", bio_zh: "AWS RDS 首席数据库工程师，专注于托管 PostgreSQL 服务和集群管理。", photo_url: photo("Maria Santos") } } },
  { id: "d1p-2b", date: "2027-04-14", start_time: "14:30", end_time: "15:15", label: "", label_zh: "", type: "session", room: "Room B — 性能与运维", sort_order: 21, session_id: "s-p6",
    sessions: { id: "s-p6", title: "PostgreSQL High Availability Best Practices", title_zh: "PostgreSQL 高可用最佳实践", abstract: "A comprehensive guide to achieving 99.99%+ uptime with PostgreSQL. We compare streaming replication, Patroni, Stolon, and cloud-native approaches, with real-world failure scenarios and recovery playbooks.", abstract_zh: "使用 PostgreSQL 实现 99.99% 以上可用性的全面指南。我们比较流复制、Patroni、Stolon 和云原生方案，结合真实故障场景和恢复预案。", duration: 45, type: "talk",
      profiles: { full_name: "Chen Yu", company: "ByteDance", bio: "Database reliability engineer managing petabyte-scale PostgreSQL deployments at ByteDance.", bio_zh: "数据库可靠性工程师，在字节跳动管理 PB 级 PostgreSQL 部署。", photo_url: photo("Chen Yu") } } },
  { id: "d1p-3b", date: "2027-04-14", start_time: "15:30", end_time: "16:15", label: "Workshop: PGAdmin Deep Dive", label_zh: "动手实践：PGAdmin 深度使用", type: "workshop", room: "Room B — 性能与运维", sort_order: 22, session_id: null, sessions: null },
  { id: "d1p-4b", date: "2027-04-14", start_time: "16:30", end_time: "17:15", label: "", label_zh: "", type: "session", room: "Room B — 性能与运维", sort_order: 23, session_id: null, sessions: null },

  // — Room C: 扩展与生态 —
  { id: "d1p-1c", date: "2027-04-14", start_time: "13:30", end_time: "14:15", label: "", label_zh: "", type: "session", room: "Room C — 扩展与生态", sort_order: 30, session_id: "s-p9",
    sessions: { id: "s-p9", title: "PostGIS: Spatial Data in the Modern Web", title_zh: "PostGIS：现代 Web 空间数据处理", abstract: "From ride-sharing to delivery routing, spatial data powers modern applications. This talk covers PostGIS best practices: indexing strategies, coordinate systems, real-time geofencing, and integration with web mapping libraries.", abstract_zh: "从打车到配送路线，空间数据驱动着现代应用。本演讲涵盖 PostGIS 最佳实践：索引策略、坐标系、实时地理围栏以及与 Web 地图库的集成。", duration: 45, type: "talk",
      profiles: { full_name: "Lin Fang", company: "Baidu Maps", bio: "Senior GIS engineer contributing to PostGIS and building spatial data platforms used by millions.", bio_zh: "资深 GIS 工程师，为 PostGIS 贡献代码并构建服务数百万用户的空间数据平台。", photo_url: photo("Lin Fang") } } },
  { id: "d1p-2c", date: "2027-04-14", start_time: "14:30", end_time: "15:15", label: "", label_zh: "", type: "session", room: "Room C — 扩展与生态", sort_order: 31, session_id: "s-p10",
    sessions: { id: "s-p10", title: "TimescaleDB: Time-Series Data at Scale", title_zh: "TimescaleDB：大规模时序数据处理", abstract: "TimescaleDB brings time-series capabilities to PostgreSQL with automatic partitioning, continuous aggregates, and native compression. We share production patterns for IoT, monitoring, and financial data.", abstract_zh: "TimescaleDB 通过自动分区、连续聚合和原生压缩为 PostgreSQL 带来时序数据处理能力。我们分享 IoT、监控和金融数据的生产模式。", duration: 45, type: "talk",
      profiles: { full_name: "Huang Lei", company: "Timescale", bio: "Solutions architect at Timescale, helping enterprises build petabyte-scale time-series platforms on PostgreSQL.", bio_zh: "Timescale 解决方案架构师，帮助企业基于 PostgreSQL 构建 PB 级时序数据平台。", photo_url: photo("Huang Lei") } } },
  { id: "d1p-3c", date: "2027-04-14", start_time: "15:30", end_time: "16:15", label: "", label_zh: "", type: "session", room: "Room C — 扩展与生态", sort_order: 32, session_id: null, sessions: null },
  { id: "d1p-4c", date: "2027-04-14", start_time: "16:30", end_time: "17:15", label: "Panel: The Future of PG Extensions", label_zh: "圆桌：PG 扩展的未来", type: "panel", room: "Room C — 扩展与生态", sort_order: 33, session_id: null, sessions: null },

  // — Room D: 应用与案例 —
  { id: "d1p-1d", date: "2027-04-14", start_time: "13:30", end_time: "14:15", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 40, session_id: "s-p13",
    sessions: { id: "s-p13", title: "Migrating from Oracle to PostgreSQL: Lessons Learned", title_zh: "从 Oracle 迁移到 PostgreSQL：经验教训", abstract: "A real-world migration story from Oracle to PostgreSQL at a Fortune 500 financial institution. Covers compatibility assessment, data type mapping, PL/SQL to PL/pgSQL conversion, and performance validation.", abstract_zh: "一家财富 500 强金融机构从 Oracle 迁移到 PostgreSQL 的真实故事。涵盖兼容性评估、数据类型映射、PL/SQL 到 PL/pgSQL 转换及性能验证。", duration: 45, type: "talk",
      profiles: { full_name: "Zhao Gang", company: "ICBC", bio: "Database architect leading the Oracle-to-PostgreSQL migration initiative at one of China's largest banks.", bio_zh: "数据库架构师，在中国最大银行之一主导 Oracle 到 PostgreSQL 的迁移项目。", photo_url: photo("Zhao Gang") } } },
  { id: "d1p-2d", date: "2027-04-14", start_time: "14:30", end_time: "15:15", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 41, session_id: "s-p14",
    sessions: { id: "s-p14", title: "PostgreSQL as a Document Store: JSONB in Production", title_zh: "PostgreSQL 文档存储：生产环境 JSONB 实践", abstract: "JSONB turns PostgreSQL into a powerful document database. We share indexing strategies, partial updates, schema validation patterns, and how we handle 10M+ JSONB documents with sub-millisecond queries.", abstract_zh: "JSONB 将 PostgreSQL 变成强大的文档数据库。我们分享索引策略、部分更新、模式验证模式以及如何处理千万级 JSONB 文档并实现亚毫秒级查询。", duration: 45, type: "talk",
      profiles: { full_name: "Sun Li", company: "Meituan", bio: "Senior backend engineer at Meituan, building high-throughput data services on PostgreSQL.", bio_zh: "美团高级后端工程师，基于 PostgreSQL 构建高吞吐数据服务。", photo_url: photo("Sun Li") } } },
  { id: "d1p-3d", date: "2027-04-14", start_time: "15:30", end_time: "16:15", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 42, session_id: null, sessions: null },
  { id: "d1p-4d", date: "2027-04-14", start_time: "16:30", end_time: "17:15", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 43, session_id: null, sessions: null },

  // ==========================================
  // DAY 2 MORNING — 分论坛 (4 rooms)
  // ==========================================
  { id: "d2m-1a", date: "2027-04-15", start_time: "09:00", end_time: "09:45", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 1, session_id: null, sessions: null },
  { id: "d2m-2a", date: "2027-04-15", start_time: "10:00", end_time: "10:45", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 2, session_id: "s-d2-2",
    sessions: { id: "s-d2-2", title: "Understanding PostgreSQL MVCC Internals", title_zh: "理解 PostgreSQL MVCC 内部机制", abstract: "MVCC is the foundation of PostgreSQL's concurrency model. We walk through tuple visibility, snapshot management, vacuum internals, and how to diagnose and fix common MVCC-related performance issues.", abstract_zh: "MVCC 是 PostgreSQL 并发模型的基础。我们介绍元组可见性、快照管理、Vacuum 内部机制，以及如何诊断和修复常见的 MVCC 相关性能问题。", duration: 45, type: "talk",
      profiles: { full_name: "Zhang Wei", company: "IvorySQL", bio: "Core contributor to PostgreSQL and founder of the IvorySQL project. 15+ years in database kernel development.", bio_zh: "PostgreSQL 核心贡献者，IvorySQL 项目创始人。15年以上数据库内核开发经验。", photo_url: photo("Zhang Wei") } } },
  { id: "d2m-3a", date: "2027-04-15", start_time: "11:00", end_time: "11:45", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 3, session_id: null, sessions: null },
  { id: "d2m-4a", date: "2027-04-15", start_time: "12:00", end_time: "13:30", label: "Lunch Break", label_zh: "午餐", type: "break", room: null, sort_order: 99, session_id: null, sessions: null },

  { id: "d2m-1b", date: "2027-04-15", start_time: "09:00", end_time: "09:45", label: "", label_zh: "", type: "session", room: "Room B — 性能与运维", sort_order: 10, session_id: "s-d2b1",
    sessions: { id: "s-d2b1", title: "Connection Pooling: PgBouncer vs Odyssey", title_zh: "连接池：PgBouncer vs Odyssey", abstract: "Choosing the right connection pooler is critical for PostgreSQL at scale. We benchmark PgBouncer and Odyssey across transaction throughput, memory usage, and failover behavior under production-like workloads.", abstract_zh: "选择合适的连接池对大规模 PostgreSQL 至关重要。我们在类似生产的负载下对 PgBouncer 和 Odyssey 进行事务吞吐量、内存使用和故障转移行为的基准测试。", duration: 45, type: "talk",
      profiles: { full_name: "Alex Johnson", company: "GitLab", bio: "Staff database engineer at GitLab, maintaining one of the world's largest PostgreSQL fleets.", bio_zh: "GitLab 高级数据库工程师，维护全球最大的 PostgreSQL 集群之一。", photo_url: photo("Alex Johnson") } } },
  { id: "d2m-2b", date: "2027-04-15", start_time: "10:00", end_time: "10:45", label: "", label_zh: "", type: "session", room: "Room B — 性能与运维", sort_order: 11, session_id: null, sessions: null },
  { id: "d2m-3b", date: "2027-04-15", start_time: "11:00", end_time: "11:45", label: "Workshop: Disaster Recovery Drill", label_zh: "动手实践：灾难恢复演练", type: "workshop", room: "Room B — 性能与运维", sort_order: 12, session_id: null, sessions: null },
  { id: "d2m-4b", date: "2027-04-15", start_time: "12:00", end_time: "13:30", label: "Lunch Break", label_zh: "午餐", type: "break", room: null, sort_order: 99, session_id: null, sessions: null },

  { id: "d2m-1c", date: "2027-04-15", start_time: "09:00", end_time: "09:45", label: "", label_zh: "", type: "session", room: "Room C — 扩展与生态", sort_order: 20, session_id: "s-d2c1",
    sessions: { id: "s-d2c1", title: "PGVector: Building RAG Applications", title_zh: "PGVector：构建 RAG 应用", abstract: "Retrieval-Augmented Generation (RAG) is the most popular pattern for building AI applications with PostgreSQL. We cover embedding strategies, hybrid search (semantic + keyword), and production deployment patterns.", abstract_zh: "检索增强生成 (RAG) 是使用 PostgreSQL 构建 AI 应用最流行的模式。我们涵盖嵌入策略、混合搜索（语义 + 关键词）以及生产部署模式。", duration: 45, type: "talk",
      profiles: { full_name: "Liu Ming", company: "Alibaba Cloud", bio: "Senior database engineer specializing in PostgreSQL query optimization and AI integration.", bio_zh: "高级数据库工程师，专攻 PostgreSQL 查询优化和 AI 集成。", photo_url: photo("Liu Ming") } } },
  { id: "d2m-2c", date: "2027-04-15", start_time: "10:00", end_time: "10:45", label: "", label_zh: "", type: "session", room: "Room C — 扩展与生态", sort_order: 21, session_id: null, sessions: null },
  { id: "d2m-3c", date: "2027-04-15", start_time: "11:00", end_time: "11:45", label: "Panel: Open Source Database Licensing", label_zh: "圆桌：开源数据库许可", type: "panel", room: "Room C — 扩展与生态", sort_order: 22, session_id: null, sessions: null },
  { id: "d2m-4c", date: "2027-04-15", start_time: "12:00", end_time: "13:30", label: "Lunch Break", label_zh: "午餐", type: "break", room: null, sort_order: 99, session_id: null, sessions: null },

  { id: "d2m-1d", date: "2027-04-15", start_time: "09:00", end_time: "09:45", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 30, session_id: "s-d2d1",
    sessions: { id: "s-d2d1", title: "PostgreSQL in E-Commerce: A JD.com Story", title_zh: "PostgreSQL 在电商：京东实践", abstract: "How JD.com runs PostgreSQL at hyperscale during 618 and Singles' Day shopping festivals. Covers sharding strategies, real-time inventory with logical replication, and handling millions of transactions per second.", abstract_zh: "京东如何在 618 和双十一购物节期间以超大规模运行 PostgreSQL。涵盖分片策略、逻辑复制实现实时库存以及处理每秒数百万笔交易。", duration: 45, type: "talk",
      profiles: { full_name: "Zhou Tao", company: "JD.com", bio: "Principal database engineer at JD.com, architecting the database infrastructure for China's largest e-commerce platform.", bio_zh: "京东首席数据库工程师，为中国最大电商平台设计数据库基础设施架构。", photo_url: photo("Zhou Tao") } } },
  { id: "d2m-2d", date: "2027-04-15", start_time: "10:00", end_time: "10:45", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 31, session_id: null, sessions: null },
  { id: "d2m-3d", date: "2027-04-15", start_time: "11:00", end_time: "11:45", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 32, session_id: null, sessions: null },
  { id: "d2m-4d", date: "2027-04-15", start_time: "12:00", end_time: "13:30", label: "Lunch Break", label_zh: "午餐", type: "break", room: null, sort_order: 99, session_id: null, sessions: null },

  // ==========================================
  // DAY 2 AFTERNOON — 分论坛 (4 rooms)
  // ==========================================
  { id: "d2pm-1a", date: "2027-04-15", start_time: "13:30", end_time: "14:15", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 50, session_id: null, sessions: null },
  { id: "d2pm-2a", date: "2027-04-15", start_time: "14:30", end_time: "15:15", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 51, session_id: null, sessions: null },
  { id: "d2pm-3a", date: "2027-04-15", start_time: "15:30", end_time: "16:15", label: "", label_zh: "", type: "session", room: "Room A — 数据库内核", sort_order: 52, session_id: null, sessions: null },
  { id: "d2pm-4a", date: "2027-04-15", start_time: "16:30", end_time: "17:00", label: "Closing & Lucky Draw", label_zh: "闭幕 & 抽奖", type: "closing", room: "Main Hall", sort_order: 90, session_id: null, sessions: null },

  { id: "d2pm-1b", date: "2027-04-15", start_time: "13:30", end_time: "14:15", label: "", label_zh: "", type: "session", room: "Room B — 性能与运维", sort_order: 60, session_id: null, sessions: null },
  { id: "d2pm-2b", date: "2027-04-15", start_time: "14:30", end_time: "15:15", label: "", label_zh: "", type: "session", room: "Room B — 性能与运维", sort_order: 61, session_id: null, sessions: null },
  { id: "d2pm-3b", date: "2027-04-15", start_time: "15:30", end_time: "16:15", label: "", label_zh: "", type: "session", room: "Room B — 性能与运维", sort_order: 62, session_id: null, sessions: null },
  { id: "d2pm-4b", date: "2027-04-15", start_time: "16:30", end_time: "17:00", label: "Closing & Lucky Draw", label_zh: "闭幕 & 抽奖", type: "closing", room: "Main Hall", sort_order: 90, session_id: null, sessions: null },

  { id: "d2pm-1c", date: "2027-04-15", start_time: "13:30", end_time: "14:15", label: "", label_zh: "", type: "session", room: "Room C — 扩展与生态", sort_order: 70, session_id: null, sessions: null },
  { id: "d2pm-2c", date: "2027-04-15", start_time: "14:30", end_time: "15:15", label: "", label_zh: "", type: "session", room: "Room C — 扩展与生态", sort_order: 71, session_id: null, sessions: null },
  { id: "d2pm-3c", date: "2027-04-15", start_time: "15:30", end_time: "16:15", label: "", label_zh: "", type: "session", room: "Room C — 扩展与生态", sort_order: 72, session_id: null, sessions: null },
  { id: "d2pm-4c", date: "2027-04-15", start_time: "16:30", end_time: "17:00", label: "Closing & Lucky Draw", label_zh: "闭幕 & 抽奖", type: "closing", room: "Main Hall", sort_order: 90, session_id: null, sessions: null },

  { id: "d2pm-1d", date: "2027-04-15", start_time: "13:30", end_time: "14:15", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 80, session_id: null, sessions: null },
  { id: "d2pm-2d", date: "2027-04-15", start_time: "14:30", end_time: "15:15", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 81, session_id: "s-d2last",
    sessions: { id: "s-d2last", title: "How We Built a Multi-Tenant SaaS with PostgreSQL", title_zh: "用 PostgreSQL 构建多租户 SaaS 平台", abstract: "Multi-tenancy is one of the hardest problems in SaaS architecture. We present our approach using PostgreSQL row-level security, schema-per-tenant patterns, and connection management for thousands of tenants on a single cluster.", abstract_zh: "多租户是 SaaS 架构中最难的问题之一。我们介绍使用 PostgreSQL 行级安全、每租户模式以及单个集群上数千租户的连接管理的方法。", duration: 45, type: "talk",
      profiles: { full_name: "Wu Ming", company: "Tencent Cloud", bio: "Senior architect at Tencent Cloud, building PostgreSQL-powered SaaS platforms serving millions of businesses.", bio_zh: "腾讯云高级架构师，构建基于 PostgreSQL 的 SaaS 平台，服务数百万企业。", photo_url: photo("Wu Ming") } } },
  { id: "d2pm-3d", date: "2027-04-15", start_time: "15:30", end_time: "16:15", label: "", label_zh: "", type: "session", room: "Room D — 应用与案例", sort_order: 82, session_id: null, sessions: null },
  { id: "d2pm-4d", date: "2027-04-15", start_time: "16:30", end_time: "17:00", label: "Closing & Lucky Draw", label_zh: "闭幕 & 抽奖", type: "closing", room: "Main Hall", sort_order: 90, session_id: null, sessions: null },
]

// --- Mutable shared stores (persisted to localStorage in browser) ---

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const stored = localStorage.getItem(key)
    if (stored) return JSON.parse(stored)
  } catch {}
  return fallback
}

function saveToStorage(key: string, data: any) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

const defaultSponsors = [
  { id: "msp1", name: "IvorySQL", logo_url: "", tier: "diamond", website_url: "https://ivorysql.org", sort_order: 1 },
  { id: "msp2", name: "HighGo Software", logo_url: "", tier: "diamond", website_url: "https://highgo.com", sort_order: 2 },
  { id: "msp3", name: "Supabase", logo_url: "", tier: "gold", website_url: "https://supabase.com", sort_order: 3 },
  { id: "msp4", name: "Alibaba Cloud", logo_url: "", tier: "gold", website_url: "https://alibabacloud.com", sort_order: 4 },
  { id: "msp5", name: "PingCAP", logo_url: "", tier: "silver", website_url: "https://pingcap.com", sort_order: 5 },
  { id: "msp6", name: "ByteDance", logo_url: "", tier: "silver", website_url: "https://bytedance.com", sort_order: 6 },
  { id: "msp7", name: "NebulaGraph", logo_url: "", tier: "bronze", website_url: "https://nebula-graph.io", sort_order: 7 },
  { id: "msp8", name: "OceanBase", logo_url: "", tier: "bronze", website_url: "https://oceanbase.com", sort_order: 8 },
]

let _sponsors: typeof defaultSponsors | null = null

function getSponsorsInternal(): typeof defaultSponsors {
  if (typeof window !== "undefined") {
    if (!_sponsors) _sponsors = loadFromStorage("how2027_sponsors", defaultSponsors)
    return _sponsors
  }
  return defaultSponsors
}

export function getSponsors() { return getSponsorsInternal() }
export function setSponsors(s: typeof defaultSponsors) { _sponsors = s; saveToStorage("how2027_sponsors", s) }
export function addSponsor(s: typeof defaultSponsors[0]) {
  const current = getSponsorsInternal()
  _sponsors = [...current, s]
  saveToStorage("how2027_sponsors", _sponsors)
}
export function updateSponsor(id: string, data: Partial<typeof defaultSponsors[0]>) {
  const current = getSponsorsInternal()
  _sponsors = current.map(s => s.id === id ? { ...s, ...data } : s)
  saveToStorage("how2027_sponsors", _sponsors)
}
export function removeSponsor(id: string) {
  const current = getSponsorsInternal()
  _sponsors = current.filter(s => s.id !== id)
  saveToStorage("how2027_sponsors", _sponsors)
}

const defaultNews = [
  { id: "mn1", title: "CFP is Now Open!", title_zh: "演讲征集现已开启！", content: "We are excited to announce that the Call for Proposals (CFP) for HOW 2027 is now open.", content_zh: "我们很高兴地宣布，HOW 2027 演讲征集现已开启。", published_at: "2026-11-01T00:00:00Z" },
  { id: "mn2", title: "Venue Announced: Jinan Shandong Hotel", title_zh: "会场公布：济南山东大厦", content: "HOW 2027 will be held at Jinan Shandong Hotel.", content_zh: "HOW 2027 将在济南山东大厦举办。", published_at: "2026-12-15T00:00:00Z" },
  { id: "mn3", title: "Early Bird Registration Opens", title_zh: "早鸟票注册开启", content: "Early bird tickets for HOW 2027 are now available.", content_zh: "HOW 2027 早鸟票现已发售。", published_at: "2027-01-10T00:00:00Z" },
]

let _news: typeof defaultNews | null = null

function getNewsInternal(): typeof defaultNews {
  if (typeof window !== "undefined") {
    if (!_news) _news = loadFromStorage("how2027_news", defaultNews)
    return _news
  }
  return defaultNews
}

export function getNews() { return getNewsInternal() }
export function setNews(n: typeof defaultNews) { _news = n; saveToStorage("how2027_news", n) }
export function addNews(n: typeof defaultNews[0]) { const c = getNewsInternal(); _news = [...c, n]; saveToStorage("how2027_news", _news) }
export function updateNews(id: string, data: Partial<typeof defaultNews[0]>) { const c = getNewsInternal(); _news = c.map(n => n.id === id ? { ...n, ...data } : n); saveToStorage("how2027_news", _news) }
export function removeNews(id: string) { const c = getNewsInternal(); _news = c.filter(n => n.id !== id); saveToStorage("how2027_news", _news) }

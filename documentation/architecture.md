# SaaS ERP Architecture

## 1. System Context Diagram (Level 1)

This diagram illustrates the SaaS ERP system in its environment, showing the users who interact with it and the external systems it depends on.

```mermaid
C4Context
    title System Context for Multi-Tenant SaaS ERP

    Person(admin, "Platform Admin", "Manages the entire platform, tenants, and global settings.")
    Person(manager, "Tenant Manager", "Manages a specific tenant's users, settings, and high-level reports.")
    Person(accountant, "Accountant", "Manages financial data, CoA, invoices, payments, and P&L reports.")
    Person(employee, "Employee", "Handles day-to-day operations like managing products, customers, and orders.")

    System(erp, "SaaS ERP Platform", "Allows tenants to manage their business operations, inventory, and financials securely.")

    Rel(admin, erp, "Manages platform and tenants", "HTTPS")
    Rel(manager, erp, "Manages tenant settings and users", "HTTPS")
    Rel(accountant, erp, "Manages financials and reporting", "HTTPS")
    Rel(employee, erp, "Manages products and orders", "HTTPS")
```

## 2. Container Diagram (Level 2)

This diagram zooms into the SaaS ERP system to show the high-level technical containers that make up the system.

```mermaid
C4Container
    title Container Diagram for SaaS ERP Platform

    Person(user, "User", "Admin, Manager, Accountant, or Employee.")

    System_Boundary(erp_boundary, "SaaS ERP Platform") {
        Container(spa, "Single Page Application", "React, Vite, Zustand, React Query", "Provides the user interface for the ERP platform.")
        Container(api, "API Application", "Node.js, NestJS, TypeScript", "Provides the backend REST APIs, enforces multi-tenancy, RBAC, and business logic.")
        ContainerDb(db, "Primary Database", "PostgreSQL", "Stores user, tenant, product, order, invoice, and financial data securely. Uses composite indexes for tenant isolation.")
        Container(cache, "Cache & Queue Store", "Redis", "Caches frequently accessed data (e.g., CoA) and stores background job queues.")
        Container(worker, "Background Worker", "Node.js, BullMQ", "Processes asynchronous background jobs like report generation.")
    }

    Rel(user, spa, "Interacts with", "HTTPS")
    Rel(spa, api, "Makes API calls to", "JSON/HTTPS")
    Rel(api, db, "Reads from and writes to", "Prisma/TCP")
    Rel(api, cache, "Reads from and writes to", "Redis/TCP")
    Rel(api, worker, "Enqueues jobs into", "Redis/TCP")
    Rel(worker, db, "Reads from and writes to", "Prisma/TCP")
    Rel(worker, cache, "Polls queue from", "Redis/TCP")
```

## 3. Component Diagram (Level 3 - Backend API)

This diagram zooms into the NestJS API Application to show the structural components modeled after Clean Architecture principles.

```mermaid
C4Component
    title Component Diagram for API Application (Clean Architecture)

    Container(spa, "Single Page Application", "React", "Frontend Interface")
    ContainerDb(db, "Primary Database", "PostgreSQL", "Stores system data")

    Container_Boundary(api_boundary, "API Application") {
        Component(auth_middleware, "Auth & Tenant Middleware", "NestJS Middleware / Guards", "Extracts JWT, validates session, and resolves Tenant ID. Enforces RBAC permissions.")
        
        Component(presentation, "Presentation Layer (Controllers)", "NestJS Controllers", "Handles HTTP requests, standardizes responses, and performs DTO validation.")
        
        Component(application, "Application Layer (Use Cases)", "NestJS Services", "Orchestrates business workflows, applies transaction boundaries, and coordinates domain logic.")
        
        Component(domain, "Domain Layer", "TypeScript Classes/Entities", "Encapsulates pure business rules and domain entities with zero external dependencies.")
        
        Component(infrastructure, "Infrastructure Layer", "NestJS Repositories / Prisma", "Implements database access (Prisma), Redis caching, and external APIs. Enforces tenant isolation on all queries.")
    }

    Rel(spa, presentation, "Makes REST calls to", "JSON/HTTPS")
    
    Rel(presentation, auth_middleware, "Intercepted by")
    Rel(auth_middleware, presentation, "Passes context to")
    
    Rel(presentation, application, "Invokes use cases")
    Rel(application, domain, "Uses core entities & rules")
    Rel(application, infrastructure, "Calls infrastructure ports")
    
    Rel(infrastructure, db, "Executes SQL queries", "Prisma")
```

## 4. Data Flow Explanation

The SaaS ERP requires strict multi-tenancy and data isolation. Below is the data flow for a typical request (e.g., retrieving financial data):

1. **Client Request**: The client (React SPA) sends an HTTP REST request containing a valid JWT in the `Authorization` header.
2. **Middleware/Guards (Security & Tenancy)**: 
   - The **AuthGuard** validates the JWT and extracts the user context (including roles and `tenantId`).
   - The **RolesGuard** checks if the user has the required RBAC permissions for the endpoint.
3. **Presentation Layer (Controller)**:
   - The NestJS Controller receives the request, validates the incoming payload using `class-validator` DTOs, and extracts the `tenantId` from the request context.
   - It delegates the operation to the appropriate Use Case in the Application Layer.
4. **Application Layer (Use Case/Service)**:
   - The Use Case orchestrates the business logic.
   - If a transaction is required (e.g., creating an invoice and updating stock), it initiates a database transaction via the Infrastructure layer.
   - It instantiates Domain Entities and applies pure business rules.
5. **Infrastructure Layer (Repository/Prisma)**:
   - The Repository acts as a data access port. It receives requests containing the `tenantId`.
   - **Crucial Multi-Tenancy Enforcement**: The repository incorporates the `tenantId` into every Prisma query, ensuring cross-tenant queries never happen.
   - Redis caching is checked (e.g., for Chart of Accounts). If a cache miss occurs, data is fetched from PostgreSQL.
6. **Data Retrieval and Response**:
   - The database executes the query utilizing composite indexes (e.g., `(tenantId, id)` or `(tenantId, status)`).
   - Domain models are reconstructed and returned to the Application Layer.
   - The Application Layer maps domain models to response DTOs, ensuring sensitive internal models are scrubbed.
   - The Presentation layer returns the structured JSON response back to the client.

## 5. Deployment Architecture (Docker)

The system is fully containerized for scalable deployment.

- **Web Tier**: Nginx or Traefik serving the Vite/React static bundle.
- **Application Tier**: NestJS API nodes running in stateless Docker containers. Scaled horizontally behind a load balancer.
- **Background Workers**: BullMQ worker nodes in separate Docker instances dedicated to processing asynchronous tasks (e.g., heavy report generation).
- **Data Tier**:
  - **PostgreSQL**: Managed relation database for persistent storage.
  - **Redis**: In-memory data store for caching and managing BullMQ operations.

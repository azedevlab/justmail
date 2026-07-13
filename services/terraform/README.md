# JustMail Terraform modules

One-click deployments per provider.

## Modules

- `aws/` — VPC + EKS + RDS Postgres + ElastiCache Redis + S3.
- `hetzner/` — HCloud VMs + managed Postgres + object storage.
- `do/` — DOKS + managed DB + Spaces.

## Usage (AWS)

```hcl
module "justmail" {
  source  = "azedevlab/justmail/aws"
  version = "1.0.0"

  domain          = "mail.example.com"
  admin_email     = "postmaster@example.com"
  vpc_id          = module.network.vpc_id
  private_subnets = module.network.private_subnets
  public_subnets  = module.network.public_subnets

  db_instance_class    = "db.t4g.medium"
  redis_node_type      = "cache.t4g.micro"
  attachments_bucket   = "justmail-prod-attachments"
  dns_zone_id          = data.aws_route53_zone.this.zone_id
}
```

Modules are published to the Terraform Registry once v1.0 GA lands.

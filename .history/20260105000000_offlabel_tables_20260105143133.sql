-- Off-Label Publication Tables
-- Migration: 20260105000000_offlabel_tables.sql
-- Apply via: Supabase Dashboard > SQL Editor, or npx supabase db push

-- ============================================
-- AUTHORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS offlabel_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credentials TEXT NOT NULL,  -- e.g., 'MD', 'MD, PhD'
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  image_url TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS offlabel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL,              -- For meta description, ~160 chars
  content TEXT NOT NULL,              -- HTML content
  key_takeaway TEXT,                  -- Single sentence for featured snippets
  author_id UUID REFERENCES offlabel_authors(id) ON DELETE SET NULL,
  
  -- Categorization
  series TEXT CHECK (series IN ('off-label', 'clinical-wisdom', 'literature-renaissance')),
  topics TEXT[] DEFAULT '{}',         -- Array of topic tags
  
  -- Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  
  -- Audio (future feature)
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  
  -- Metadata
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REFERENCES TABLE (Academic Citations)
-- ============================================
CREATE TABLE IF NOT EXISTS offlabel_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES offlabel_posts(id) ON DELETE CASCADE,
  citation_key TEXT NOT NULL,         -- e.g., 'hori2025'
  authors TEXT NOT NULL,
  title TEXT NOT NULL,
  journal TEXT,
  year INTEGER NOT NULL,
  doi TEXT,
  pmid TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_offlabel_posts_slug ON offlabel_posts(slug);
CREATE INDEX IF NOT EXISTS idx_offlabel_posts_status ON offlabel_posts(status);
CREATE INDEX IF NOT EXISTS idx_offlabel_posts_published_at ON offlabel_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_offlabel_posts_author ON offlabel_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_offlabel_authors_slug ON offlabel_authors(slug);
CREATE INDEX IF NOT EXISTS idx_offlabel_references_post ON offlabel_references(post_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE offlabel_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE offlabel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE offlabel_references ENABLE ROW LEVEL SECURITY;

-- Public read access for published content
CREATE POLICY "Public can read active authors"
  ON offlabel_authors FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public can read published posts"
  ON offlabel_posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Public can read references for published posts"
  ON offlabel_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM offlabel_posts 
      WHERE offlabel_posts.id = offlabel_references.post_id 
      AND offlabel_posts.status = 'published'
    )
  );

-- Service role has full access (for admin operations)
CREATE POLICY "Service role full access to authors"
  ON offlabel_authors FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to posts"
  ON offlabel_posts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to references"
  ON offlabel_references FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- SEED DATA: Initial Author (Rufus)
-- ============================================
INSERT INTO offlabel_authors (name, credentials, slug, bio, email)
VALUES (
  'Rufus Sweeney',
  'MD',
  'rufus-sweeney',
  'Rufus Sweeney is a psychiatrist at Moonlit Psychiatry in Salt Lake City, Utah. He writes about treatments that work—even when they weren''t supposed to.',
  'rufus@trymoonlit.com'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_offlabel_authors_updated_at ON offlabel_authors;
CREATE TRIGGER update_offlabel_authors_updated_at
  BEFORE UPDATE ON offlabel_authors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_offlabel_posts_updated_at ON offlabel_posts;
CREATE TRIGGER update_offlabel_posts_updated_at
  BEFORE UPDATE ON offlabel_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION QUERY (run after migration)
-- ============================================
-- SELECT 
--   'offlabel_authors' as table_name, count(*) as row_count FROM offlabel_authors
-- UNION ALL
-- SELECT 
--   'offlabel_posts', count(*) FROM offlabel_posts
-- UNION ALL
-- SELECT 
--   'offlabel_references', count(*) FROM offlabel_references;

-- Catalog only: never rewrite question classifications, answers or learning history.
CREATE TABLE major_categories (
  code varchar(50) PRIMARY KEY,
  label text NOT NULL CHECK (length(label)>0),
  sort_order integer NOT NULL CHECK (sort_order>=0)
);
CREATE TABLE minor_categories (
  code varchar(50) PRIMARY KEY,
  major_category_code varchar(50) NOT NULL REFERENCES major_categories(code),
  label text NOT NULL CHECK (length(label)>0),
  sort_order integer NOT NULL CHECK (sort_order>=0)
);
CREATE INDEX minor_categories_parent_order ON minor_categories(major_category_code,sort_order);

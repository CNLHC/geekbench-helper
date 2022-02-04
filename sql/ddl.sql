create table geekbench5_cpu
(
    id              bigint not null
        constraint geekbench5_cpu_pk
            primary key,
    cpu             text,
    sys             text,
    date            timestamp,
    platform        text,
    single_score    integer,
    multi_score     integer,
    cached_document tsvector
);

alter table geekbench5_cpu
    owner to notes;


-- GIN index to accelerate search
create index idx_gin_document
    on geekbench5_cpu using gin (cached_document);

-- automatic cache searchable attributes
create trigger update_cached_document
    before insert or update
    on geekbench5_cpu
    for each row
execute procedure tsvector_update_trigger('cached_document', 'pg_catalog.english', 'cpu', 'sys');


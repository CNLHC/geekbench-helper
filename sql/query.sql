SELECT sys, cpu, single_score, multi_score
FROM geekbench5_cpu
WHERE cached_document @@ PLAINTO_TSQUERY('english', 'Gold 6148 40 cores')
ORDER BY multi_score DESC







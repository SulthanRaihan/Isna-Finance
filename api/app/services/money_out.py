async def current_postings(repo, rows, source_type):
    if not rows:
        return rows
    postings = await repo.request(
        "POST",
        "rpc/current_fee_outflows",
        payload={
            "p_source": source_type,
            "p_ids": [str(r["id"]) for r in rows],
        },
    )
    latest = {str(r["source_id"]): r for r in postings}
    return [dict(r, current_outflow=latest.get(str(r["id"]))) for r in rows]

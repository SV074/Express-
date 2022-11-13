export function view(res, template, meta, data) {
    return res.render('app', {
        template: template,
        meta: meta,
        data: {...data, ...{ auth: res.auth } }
    });
}

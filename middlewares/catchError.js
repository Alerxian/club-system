

let catchError = async (ctx, next) => {
    try {
        await next();
        if(ctx.status === 404) {
            return ctx.render('admin/page-error');
        }
    }catch (err) {
        console.error(err);
        const status = err.status || 500;
        ctx.status = status;
        if(status === 400 || status === 500)
        return ctx.render('admin/page-error');
    }
}

exports.catchError = catchError;
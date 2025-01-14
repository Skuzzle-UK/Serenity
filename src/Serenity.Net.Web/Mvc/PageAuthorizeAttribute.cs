﻿using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace Serenity.Web
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class PageAuthorizeAttribute : TypeFilterAttribute
    {
        public PageAuthorizeAttribute()
            : base(typeof(PageAuthorizeFilter))
        {
            Arguments = new[] { this };
        }

        private class PageAuthorizeFilter : IResourceFilter
        {
            readonly PageAuthorizeAttribute attr;

            public PageAuthorizeFilter(PageAuthorizeAttribute attr)
            {
                this.attr = attr;
            }

            public void OnResourceExecuted(ResourceExecutedContext context)
            {
            }

            public void OnResourceExecuting(ResourceExecutingContext context)
            {
                if ((string.IsNullOrEmpty(attr.Permission) &&
                     !context.HttpContext.User.IsLoggedIn()) ||
                    (!string.IsNullOrEmpty(attr.Permission) &&
                     !context.HttpContext.RequestServices.GetRequiredService<IPermissionService>().HasPermission(attr.Permission)))
                {
                    if (context.HttpContext.User.IsLoggedIn())
                        context.Result = new ForbidResult();
                    else
                        context.Result = new ChallengeResult();
                }
            }
        }

        protected PageAuthorizeAttribute(Type sourceType, params Type[] attributeTypes)
            : this()
        {
            if (sourceType == null)
                throw new ArgumentNullException(nameof(sourceType));

            if (attributeTypes.IsEmptyOrNull())
                throw new ArgumentNullException(nameof(attributeTypes));

            PermissionAttributeBase attr = null;
            foreach (var attributeType in attributeTypes)
            {
                var lst = sourceType.GetCustomAttributes(attributeType, true);
                if (lst.Length > 0)
                {
                    attr = lst[0] as PermissionAttributeBase;
                    if (attr == null)
                        throw new ArgumentOutOfRangeException(attributeType.Name +
                            " is not a subclass of PermissionAttributeBase!");

                    break;
                }
            }

            if (attr == null)
            {
                throw new ArgumentOutOfRangeException(nameof(sourceType),
                    "PageAuthorize attribute is created with source type of " +
                    sourceType.Name + ", but it has no " +
                    string.Join(" OR ", attributeTypes.Select(x => x.Name)) + " attribute(s)");
            }

            Permission = attr.Permission;
        }

        public PageAuthorizeAttribute(Type sourceType)
            : this(sourceType, typeof(NavigationPermissionAttribute), typeof(ReadPermissionAttribute))
        {
        }

        public PageAuthorizeAttribute(object permission)
            : this()
        {
            Permission = permission?.ToString();
        }

        public PageAuthorizeAttribute(object module, object permission)
            : this(module.ToString() + ":" + permission)
        {
        }

        public PageAuthorizeAttribute(object module, object submodule, object permission)
            : this(module.ToString() + ":" + submodule + ":" + permission)
        {
        }

        public string Permission { get; private set; }
    }
}
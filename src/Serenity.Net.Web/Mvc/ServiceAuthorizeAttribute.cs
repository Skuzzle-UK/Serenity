﻿using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

namespace Serenity.Services
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
    public class ServiceAuthorizeAttribute : Attribute, IResourceFilter
    {
        public void OnResourceExecuted(ResourceExecutedContext context)
        {
        }

        public void OnResourceExecuting(ResourceExecutingContext context)
        {
            if (string.IsNullOrEmpty(Permission))
            {
                if (context.HttpContext.User.IsLoggedIn())
                    return;
            }
            else if (context.HttpContext.RequestServices.GetRequiredService<IPermissionService>().HasPermission(Permission))
                return;

            if (!string.IsNullOrEmpty(OrPermission) &&
                context.HttpContext.RequestServices.GetRequiredService<IPermissionService>().HasPermission(OrPermission))
                return;

            var myIndex = context.Filters.IndexOf(this);
            if (myIndex >= 0 && context.Filters.Skip(myIndex + 1)
                .Any(x => x is ServiceAuthorizeAttribute a && a.Override == true))
                return;

            var localizer = context.HttpContext.RequestServices.GetRequiredService<ITextLocalizer>();

            if (context.HttpContext.User.IsLoggedIn())
            {
                context.Result = new Result<ServiceResponse>(new ServiceResponse
                {
                    Error = new ServiceError
                    {
                        Code = "AccessDenied",
                        Message = localizer.Get("Authorization.AccessDenied")
                    }
                });
                context.HttpContext.Response.StatusCode = 400;
            }
            else
            {
                context.Result = new Result<ServiceResponse>(new ServiceResponse
                {
                    Error = new ServiceError
                    {
                        Code = "NotLoggedIn",
                        Message = localizer.Get("Authorization.NotLoggedIn")
                    }
                });
                context.HttpContext.Response.StatusCode = 400;
            }
        }
     
        public ServiceAuthorizeAttribute()
        {
        }

        protected ServiceAuthorizeAttribute(Type sourceType, params Type[] attributeTypes)
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
                    "ServiceAuthorize attribute is created with source type of " +
                    sourceType.Name + ", but it has no " +
                    string.Join(" OR ", attributeTypes.Select(x => x.Name)) + " attribute(s)");
            }

            Permission = attr.Permission;
        }

        public ServiceAuthorizeAttribute(Type sourceType)
            : this(sourceType, typeof(ReadPermissionAttribute))
        {
        }

        public ServiceAuthorizeAttribute(object permission)
            : this()
        {
            Permission = permission?.ToString();
        }

        public ServiceAuthorizeAttribute(object module, object permission)
            : this(module.ToString() + ":" + permission)
        {
        }

        public ServiceAuthorizeAttribute(object module, object submodule, object permission)
            : this(module.ToString() + ":" + submodule + ":" + permission)
        {
        }

        public string Permission { get; private set; }
        protected string OrPermission { get; set; }
        public bool Override { get; set; } = true;
    }
}